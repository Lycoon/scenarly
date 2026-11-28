//! Windows only: answer WebView2's microphone request ourselves.
//!
//! Left to itself, WebView2 shows its own permission bubble for `getUserMedia`,
//! and that bubble names the page's origin — "tauri.localhost wants to use your
//! microphone" — which reads as something other than Scenarly asking. The app's
//! own pages are not a website the user needs protecting from, so the request is
//! granted here and the bubble never appears.
//!
//! The OS still has the last word: the MSIX manifest declares the `microphone`
//! device capability (gen/windows/bundle.config.json), so Windows' own consent
//! prompt — the one that names the app — and the Settings › Privacy toggle keep
//! applying on top of this.
//!
//! Only the app's origin is granted. Anything else the webview might end up on
//! falls through to WebView2's default prompt.

use tauri::{webview::PlatformWebview, Url};
use webview2_com::{take_pwstr, Microsoft::Web::WebView2::Win32::*, PermissionRequestedEventHandler};
use windows::core::PWSTR;

/// Install the handler on a freshly created webview.
pub fn grant_microphone_to_app(webview: PlatformWebview) {
    unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else {
            return;
        };

        let mut token = 0i64;
        let handler = PermissionRequestedEventHandler::create(Box::new(|_, args| {
            let Some(args) = args else { return Ok(()) };

            let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
            args.PermissionKind(&mut kind)?;
            if kind != COREWEBVIEW2_PERMISSION_KIND_MICROPHONE {
                return Ok(());
            }

            let mut uri = PWSTR::null();
            args.Uri(&mut uri)?;
            if is_app_origin(&take_pwstr(uri)) {
                args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
            }
            Ok(())
        }));

        if let Err(err) = core.add_PermissionRequested(&handler, &mut token) {
            log::warn!("could not install the WebView2 permission handler: {err}");
        }
    }
}

/// The bundled frontend is served from `http://tauri.localhost`; `tauri dev`
/// points the webview at the Next dev server on `localhost` instead.
fn is_app_origin(uri: &str) -> bool {
    let Ok(url) = Url::parse(uri) else {
        return false;
    };
    match url.host_str() {
        Some("tauri.localhost") => true,
        Some("localhost") => cfg!(debug_assertions),
        _ => false,
    }
}
