/**
 * Apple StoreKit 2 / App Store Server Notifications V2 signature verification.
 *
 * Apple signs every transaction, renewal-info and notification payload as a
 * JWS and ships the signing chain in its header. Nothing in a payload can be
 * trusted until that chain is verified back to Apple's root — decoding alone
 * would let anyone hand us a "receipt" with any expiry they like. The
 * verification itself is Apple's own `SignedDataVerifier`: chain to the
 * pinned root, OCSP revocation checks, and the bundle id / environment /
 * app id claims checked against what this server is configured for.
 *
 * The verifier is bound to one store environment, and the production server
 * must accept both: App Review and TestFlight run the production build
 * against the sandbox store. So there is one verifier per environment,
 * chosen from the payload's (as yet unverified) environment claim — a claim
 * the chosen verifier then proves or rejects. Server-side only.
 */

import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from "@apple/app-store-server-library";
import { AppError } from "@src/lib/utils/api-utils";

/** The App Store app this server serves: `com.scenarly`, or `com.scenarly.staging` on the staging server. */
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? "com.scenarly";
/** The app's numeric Apple ID (App Store Connect → App Information). Production payloads carry it; sandbox ones do not. */
const APP_APPLE_ID = process.env.APPLE_APP_ID ? Number(process.env.APPLE_APP_ID) : undefined;

// Apple Root CA - G3, https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
// SHA-256 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
const APPLE_ROOT_CA_G3 = Buffer.from(
    "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==",
    "base64",
);

/**
 * A rejected or unverifiable Apple payload. 403 for a bad signature or a
 * claim that does not match this server; 503 when the check itself could
 * not run (an OCSP responder was unreachable) — Apple retries a webhook that
 * answers 5xx, and the app can simply try again.
 */
export class AppleVerificationError extends AppError {
    constructor(public readonly reason: string, retryable = false) {
        super(retryable ? 503 : 403, `Apple payload rejected: ${reason}`);
        Object.setPrototypeOf(this, AppleVerificationError.prototype);
    }
}

/** The transaction fields the billing code relies on — present on every auto-renewable subscription transaction. */
export interface AppleTransaction {
    originalTransactionId: string;
    productId: string;
    bundleId: string;
    environment: string;
    /** Milliseconds since epoch. */
    expiresDate?: number;
    /** The UUID we passed at purchase time — the buying user's id. */
    appAccountToken?: string;
    /** Set when Apple refunded or revoked the transaction. */
    revocationDate?: number;
}

export interface AppleRenewalInfo {
    /** 1 when the subscription will renew, 0 once the user turned it off. */
    autoRenewStatus?: number;
    /** Present while a failed renewal is in Apple's billing grace period. */
    gracePeriodExpiresDate?: number;
}

export interface AppleNotification {
    type: string;
    subtype?: string;
    transaction: AppleTransaction | null;
    renewal: AppleRenewalInfo | null;
}

const verifiers: Partial<Record<Environment, SignedDataVerifier>> = {};

function getVerifier(environment: Environment): SignedDataVerifier {
    if (environment === Environment.PRODUCTION && APP_APPLE_ID === undefined) {
        throw new AppleVerificationError("APPLE_APP_ID is not configured, so production payloads cannot be verified");
    }
    return (verifiers[environment] ??= new SignedDataVerifier(
        [APPLE_ROOT_CA_G3],
        true,
        environment,
        BUNDLE_ID,
        environment === Environment.PRODUCTION ? APP_APPLE_ID : undefined,
    ));
}

/** The environment a payload claims to come from; the verifier for it decides whether that is true. */
function claimedEnvironment(jws: string): Environment | null {
    try {
        const payload = JSON.parse(Buffer.from(jws.split(".")[1] ?? "", "base64url").toString()) as {
            environment?: string;
            data?: { environment?: string };
        };
        return (payload.environment ?? payload.data?.environment) === Environment.SANDBOX
            ? Environment.SANDBOX
            : Environment.PRODUCTION;
    } catch {
        return null;
    }
}

async function verify<T>(jws: string, run: (verifier: SignedDataVerifier) => Promise<T>): Promise<T> {
    const environment = claimedEnvironment(jws);
    if (!environment) throw new AppleVerificationError("malformed payload");
    try {
        return await run(getVerifier(environment));
    } catch (e) {
        if (e instanceof AppleVerificationError) throw e;
        if (e instanceof VerificationException) {
            throw new AppleVerificationError(
                VerificationStatus[e.status],
                e.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE,
            );
        }
        throw new AppleVerificationError("malformed payload");
    }
}

function requireTransaction(decoded: {
    originalTransactionId?: string;
    productId?: string;
    bundleId?: string;
    environment?: string;
    expiresDate?: number;
    appAccountToken?: string;
    revocationDate?: number;
}): AppleTransaction {
    const { originalTransactionId, productId, bundleId, environment } = decoded;
    if (!originalTransactionId || !productId || !bundleId || !environment) {
        throw new AppleVerificationError("transaction is missing its identifiers");
    }
    return {
        originalTransactionId,
        productId,
        bundleId,
        environment,
        expiresDate: decoded.expiresDate,
        appAccountToken: decoded.appAccountToken,
        revocationDate: decoded.revocationDate,
    };
}

/** A signed transaction as StoreKit hands it to the app (`jwsRepresentation`). */
export async function verifyAppleTransaction(jws: string): Promise<AppleTransaction> {
    return verify(jws, async (verifier) => requireTransaction(await verifier.verifyAndDecodeTransaction(jws)));
}

/** An App Store Server Notification V2 `signedPayload`, with its nested transaction and renewal info verified too. */
export async function verifyAppleNotification(signedPayload: string): Promise<AppleNotification> {
    return verify(signedPayload, async (verifier) => {
        const notification = await verifier.verifyAndDecodeNotification(signedPayload);
        const { signedTransactionInfo, signedRenewalInfo } = notification.data ?? {};
        return {
            type: notification.notificationType ?? "",
            subtype: notification.subtype,
            transaction: signedTransactionInfo
                ? requireTransaction(await verifier.verifyAndDecodeTransaction(signedTransactionInfo))
                : null,
            renewal: signedRenewalInfo ? await verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo) : null,
        };
    });
}
