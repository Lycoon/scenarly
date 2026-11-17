//! Sign-in that never leaves the app, on macOS and iOS.
//!
//! App Review turns away an Apple-platform app that hands sign-in to the
//! default browser (guideline 4). Two commands replace that hand-off:
//!
//!  - `sign_in_with_apple` runs the system's own Sign in with Apple sheet and
//!    answers with the credential Apple signed. The server verifies it and
//!    issues the session (`POST /api/auth/apple/native`).
//!  - `start_web_auth_session` opens a URL in `ASWebAuthenticationSession`, the
//!    one web view Apple accepts for a third-party login (Google). It answers
//!    with the callback URL the page redirected to.
//!
//! Both sheets belong to the main thread, and AuthenticationServices holds its
//! delegates weakly, so each command hops to the main thread, parks the objects
//! of its flow in `IN_FLIGHT`, and waits on a oneshot channel for the answer.

use std::any::Any;
use std::cell::{Cell, RefCell};
use std::rc::Rc;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::{NSObject, NSObjectProtocol, ProtocolObject};
use objc2::{define_class, msg_send, AllocAnyThread, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_authentication_services::{
    ASAuthorization, ASAuthorizationAppleIDCredential, ASAuthorizationAppleIDProvider,
    ASAuthorizationController, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding, ASAuthorizationError,
    ASAuthorizationErrorDomain, ASAuthorizationRequest, ASAuthorizationScopeEmail,
    ASWebAuthenticationPresentationContextProviding, ASWebAuthenticationSession,
    ASWebAuthenticationSessionErrorCode, ASWebAuthenticationSessionErrorDomain,
};
use objc2_foundation::{NSArray, NSData, NSError, NSString, NSURL};
use tauri::{AppHandle, Manager, WebviewWindow};
use tokio::sync::oneshot;

/// The error both commands answer with when the user closed the sheet. The
/// frontend reads it as "nothing happened" rather than as a failure.
const CANCELED: &str = "canceled";

type Reply<T> = oneshot::Sender<Result<T, String>>;

thread_local! {
    /// The objects of the sheet currently on screen. Nothing else retains them:
    /// without this they would be freed as the command's closure returns, and
    /// the sheet would never call back.
    ///
    /// The slot is only ever overwritten by the next flow, never cleared from a
    /// callback, so that no object is released while one of its own methods is
    /// still on the stack. A finished flow therefore lingers until the next
    /// sign-in, which costs a few idle objects.
    static IN_FLIGHT: RefCell<Option<Box<dyn Any>>> = const { RefCell::new(None) };
}

fn keep_alive(objects: impl Any) {
    IN_FLIGHT.with(|slot| *slot.borrow_mut() = Some(Box::new(objects)));
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "the main window is gone".to_string())
}

/// Run `start` on the main thread, handing it the window the sheet is
/// presented from, and wait for the answer it sends.
///
/// That window is the one the main webview sits in: an `NSWindow` on macOS, a
/// `UIWindow` on iOS, which is what AuthenticationServices calls a
/// presentation anchor on either platform.
async fn present<T: Send + 'static>(
    window: &WebviewWindow,
    start: impl FnOnce(MainThreadMarker, Retained<NSObject>, Reply<T>) + Send + 'static,
) -> Result<T, String> {
    let (reply, answer) = oneshot::channel();

    window
        .with_webview(move |webview| {
            // `with_webview` runs its closure on the main thread.
            let Some(mtm) = MainThreadMarker::new() else {
                let _ = reply.send(Err("the sign-in sheet was not started on the main thread".into()));
                return;
            };

            let view = webview.inner().cast::<NSObject>();
            // SAFETY: `inner` is the live WKWebView, a view on both platforms,
            // and a view answers `window` with its window or nil.
            let anchor: Option<Retained<NSObject>> =
                if view.is_null() { None } else { unsafe { msg_send![view, window] } };

            match anchor {
                Some(anchor) => start(mtm, anchor, reply),
                None => {
                    let _ = reply.send(Err("the main webview is not in a window".into()));
                }
            }
        })
        .map_err(|e| e.to_string())?;

    answer
        .await
        .map_err(|_| "the sign-in sheet went away without answering".to_string())?
}

/// `canceled` when the user closed the sheet, otherwise the system's wording
/// with the domain and code, which is what tells a missing entitlement from a
/// Mac that is not signed in to iCloud.
fn describe(error: &NSError, domain: &NSString, canceled: isize) -> String {
    if &*error.domain() == domain && error.code() == canceled {
        CANCELED.to_string()
    } else {
        format!("{} ({} {})", error.localizedDescription(), error.domain(), error.code())
    }
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements, and this class does
    // not implement `Drop`.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "ScenarlySignInAnchor"]
    #[ivars = Retained<NSObject>]
    struct SignInAnchor;

    unsafe impl NSObjectProtocol for SignInAnchor {}

    // The bindings only declare these two methods on macOS, but the protocols
    // require them on iOS as well.
    unsafe impl ASAuthorizationControllerPresentationContextProviding for SignInAnchor {
        #[unsafe(method_id(presentationAnchorForAuthorizationController:))]
        fn anchor_for_authorization(&self, _controller: &ASAuthorizationController) -> Retained<NSObject> {
            self.ivars().clone()
        }
    }

    unsafe impl ASWebAuthenticationPresentationContextProviding for SignInAnchor {
        #[unsafe(method_id(presentationAnchorForWebAuthenticationSession:))]
        fn anchor_for_web_session(&self, _session: &ASWebAuthenticationSession) -> Retained<NSObject> {
            self.ivars().clone()
        }
    }
);

impl SignInAnchor {
    fn new(mtm: MainThreadMarker, window: Retained<NSObject>) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(window);
        // SAFETY: `init` is NSObject's designated initializer.
        unsafe { msg_send![super(this), init] }
    }
}

/// What the Sign in with Apple sheet hands back. Both values go to the server
/// untouched: the identity token is what it verifies, the authorization code
/// is what it trades for the refresh token it revokes on account deletion.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppleCredential {
    identity_token: String,
    authorization_code: String,
}

fn read_credential(authorization: &ASAuthorization) -> Result<AppleCredential, String> {
    // SAFETY: property reads on the authorization the framework just delivered.
    let credential = unsafe { authorization.credential() }
        .downcast::<ASAuthorizationAppleIDCredential>()
        .map_err(|_| "Apple answered with something other than an Apple ID credential".to_string())?;

    let text = |data: Option<Retained<NSData>>, what: &str| {
        data.and_then(|data| String::from_utf8(data.to_vec()).ok())
            .ok_or_else(|| format!("Apple's answer carries no {what}"))
    };

    // SAFETY: as above.
    let (identity_token, authorization_code) =
        unsafe { (credential.identityToken(), credential.authorizationCode()) };

    Ok(AppleCredential {
        identity_token: text(identity_token, "identity token")?,
        authorization_code: text(authorization_code, "authorization code")?,
    })
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements, and this class does
    // not implement `Drop`.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "ScenarlyAppleSignInDelegate"]
    #[ivars = Cell<Option<Reply<AppleCredential>>>]
    struct AppleSignInDelegate;

    unsafe impl NSObjectProtocol for AppleSignInDelegate {}

    unsafe impl ASAuthorizationControllerDelegate for AppleSignInDelegate {
        #[unsafe(method(authorizationController:didCompleteWithAuthorization:))]
        fn did_complete(&self, _controller: &ASAuthorizationController, authorization: &ASAuthorization) {
            self.answer(read_credential(authorization));
        }

        #[unsafe(method(authorizationController:didCompleteWithError:))]
        fn did_fail(&self, _controller: &ASAuthorizationController, error: &NSError) {
            // SAFETY: a constant the framework exports.
            let domain = unsafe { ASAuthorizationErrorDomain };
            self.answer(Err(describe(error, domain, ASAuthorizationError::Canceled.0)));
        }
    }
);

impl AppleSignInDelegate {
    fn new(mtm: MainThreadMarker, reply: Reply<AppleCredential>) -> Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(Cell::new(Some(reply)));
        // SAFETY: `init` is NSObject's designated initializer.
        unsafe { msg_send![super(this), init] }
    }

    fn answer(&self, outcome: Result<AppleCredential, String>) {
        if let Some(reply) = self.ivars().take() {
            let _ = reply.send(outcome);
        }
    }
}

/// Show the Sign in with Apple sheet and answer with what Apple signed.
///
/// `nonce_hash` is the SHA-256 of a nonce only the frontend knows. Apple
/// copies it into the identity token, and the server accepts the token only
/// alongside the nonce that hashes to it, so a token lifted from one sign-in
/// cannot be replayed into another.
#[tauri::command]
pub async fn sign_in_with_apple(app: AppHandle, nonce_hash: String) -> Result<AppleCredential, String> {
    let window = main_window(&app)?;

    present(&window, move |mtm, window, reply| {
        // SAFETY: AuthenticationServices calls made on the main thread, on
        // objects created right here.
        unsafe {
            let request = ASAuthorizationAppleIDProvider::new().createRequest();
            request.setRequestedScopes(Some(&NSArray::from_slice(&[ASAuthorizationScopeEmail])));
            request.setNonce(Some(&NSString::from_str(&nonce_hash)));

            let request: &ASAuthorizationRequest = &request;
            let controller = ASAuthorizationController::initWithAuthorizationRequests(
                ASAuthorizationController::alloc(),
                &NSArray::from_slice(&[request]),
            );

            let delegate = AppleSignInDelegate::new(mtm, reply);
            let anchor = SignInAnchor::new(mtm, window);
            controller.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
            controller.setPresentationContextProvider(Some(ProtocolObject::from_ref(&*anchor)));
            controller.performRequests();

            keep_alive((controller, delegate, anchor));
        }
    })
    .await
}

/// Open `url` in an `ASWebAuthenticationSession` and answer with the URL it
/// was redirected to once a page navigates to `callback_scheme://…`.
///
/// The session intercepts that scheme itself, so the app registers no URL
/// type for it. It shares Safari's cookies, which is what lets someone already
/// signed in to Google there skip typing their password again.
#[tauri::command]
pub async fn start_web_auth_session(
    app: AppHandle,
    url: String,
    callback_scheme: String,
) -> Result<String, String> {
    let window = main_window(&app)?;

    let outcome = present(&window, move |mtm, window, reply: Reply<String>| {
        let Some(url) = NSURL::URLWithString(&NSString::from_str(&url)) else {
            let _ = reply.send(Err(format!("not a URL: {url}")));
            return;
        };

        // Shared with the completion block, which outlives this closure.
        let reply = Rc::new(Cell::new(Some(reply)));

        let completion = {
            let reply = Rc::clone(&reply);
            RcBlock::new(move |callback: *mut NSURL, error: *mut NSError| {
                let Some(reply) = reply.take() else { return };
                // SAFETY: the session passes a callback URL or an error, each
                // either null or valid for the length of this call.
                let outcome = match unsafe { (callback.as_ref(), error.as_ref()) } {
                    (Some(callback), _) => callback
                        .absoluteString()
                        .map(|url| url.to_string())
                        .ok_or_else(|| "the callback URL is unreadable".to_string()),
                    (None, Some(error)) => Err(describe(
                        error,
                        // SAFETY: a constant the framework exports.
                        unsafe { ASWebAuthenticationSessionErrorDomain },
                        ASWebAuthenticationSessionErrorCode::CanceledLogin.0,
                    )),
                    (None, None) => Err("the session ended without a callback URL".to_string()),
                };
                let _ = reply.send(outcome);
            })
        };

        // SAFETY: AuthenticationServices calls made on the main thread, on
        // objects created right here. The session copies the block.
        unsafe {
            // The initializer taking an `ASWebAuthenticationSessionCallback`
            // needs macOS 14.4 / iOS 17.4; the app supports macOS 13 / iOS 16.
            #[allow(deprecated)]
            let session = ASWebAuthenticationSession::initWithURL_callbackURLScheme_completionHandler(
                ASWebAuthenticationSession::alloc(),
                &url,
                Some(&NSString::from_str(&callback_scheme)),
                RcBlock::as_ptr(&completion),
            );

            // Required: without a presentation context `start` fails on macOS.
            let anchor = SignInAnchor::new(mtm, window);
            session.setPresentationContextProvider(Some(ProtocolObject::from_ref(&*anchor)));

            if session.start() {
                keep_alive((session, anchor));
            } else if let Some(reply) = reply.take() {
                let _ = reply.send(Err("the web sign-in session could not start".into()));
            }
        }
    })
    .await;

    // On a Mac the session lives in a browser window, and closing it leaves
    // whatever was behind it in front rather than the app that asked.
    #[cfg(target_os = "macos")]
    let _ = window.set_focus();

    outcome
}
