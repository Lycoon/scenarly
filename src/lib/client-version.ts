/**
 * Which build of the app a request comes from, and whether the server still
 * serves it.
 *
 * Every API request carries the build's platform and public version name
 * (MAJOR.MINOR.PATCH, see `versionName`). The server counts signed-in
 * requests per platform and released version (`http_client_requests_total`,
 * on the Grafana overview and /admin) and answers 426 to a build older than
 * the minimum set for its platform in `MIN_CLIENT_VERSIONS`; the app then asks
 * to be updated (UpdateRequiredScreen). The minimum is per platform because
 * each store approves an update on its own schedule: raise it for a store
 * only once the update can be downloaded there, or that store's users are
 * left with an app they cannot update.
 *
 * Builds from before these headers (2.2.1 and older) send no version. A
 * native one still says `x-client-type: desktop`, so its platform is read
 * from the user agent, and it counts as older than any minimum. Pure and free
 * of server and Tauri imports: the browser and the server read the same rules.
 */

export const CLIENT_VERSION_HEADER = "x-client-version";
export const CLIENT_PLATFORM_HEADER = "x-client-platform";

export const CLIENT_PLATFORMS = ["web", "ios", "macos", "android", "windows", "linux"] as const;
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

/** What the server answers a build older than its platform's minimum. */
export const UPDATE_REQUIRED_STATUS = 426;
export const UPDATE_REQUIRED_CODE = "UPDATE_REQUIRED";

/** The version label of a request that carries no valid version. */
export const UNVERSIONED = "unversioned";

/** The version label of a request naming a version that was never released. */
export const OTHER_VERSIONS = "other";

const VERSION_PATTERN = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

export const isClientPlatform = (value: string | null | undefined): value is ClientPlatform =>
    (CLIENT_PLATFORMS as readonly string[]).includes(value ?? "");

export const isVersion = (value: string | null | undefined): value is string => VERSION_PATTERN.test(value ?? "");

/**
 * The public version name (MAJOR.MINOR.PATCH) of a build's `NEXT_PUBLIC_APP_VERSION`,
 * which carries a fourth, revision segment on staging (2.2.2.5).
 */
export const versionName = (appVersion: string | undefined): string | undefined =>
    appVersion?.split(".").slice(0, 3).join(".");

/** Negative when `a` is older than `b`, 0 when equal, positive when newer. Both must pass `isVersion`. */
export function compareVersions(a: string, b: string): number {
    const left = a.split(".").map(Number);
    const right = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
        if (left[i] !== right[i]) return left[i] - right[i];
    }
    return 0;
}

export type ClientInfo = {
    /** "unknown" for a native build that names no platform and whose user agent gives none away. */
    platform: ClientPlatform | "unknown";
    /** Null when the request carries no valid version. */
    version: string | null;
    /** A Tauri shell, as opposed to a browser tab. */
    native: boolean;
};

/**
 * The platform of a native build that predates the platform header. iPadOS
 * reports a Mac user agent, so an old iPad build counts as macOS here.
 */
function platformFromUserAgent(userAgent: string): ClientPlatform | "unknown" {
    if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
    if (/Android/.test(userAgent)) return "android";
    if (/Windows/.test(userAgent)) return "windows";
    if (/Macintosh|Mac OS X/.test(userAgent)) return "macos";
    if (/Linux/.test(userAgent)) return "linux";
    return "unknown";
}

/** Who a request says it comes from. Claims only: nothing here is proof of anything. */
export function readClient(headers: Headers): ClientInfo {
    const native = headers.get("x-client-type") === "desktop";
    const claimed = headers.get(CLIENT_PLATFORM_HEADER);
    const platform = isClientPlatform(claimed)
        ? claimed
        : native
          ? platformFromUserAgent(headers.get("user-agent") ?? "")
          : "web";
    const version = headers.get(CLIENT_VERSION_HEADER);
    return { platform, version: isVersion(version) ? version : null, native };
}

export type MinimumVersions = Partial<Record<ClientPlatform, string>>;

/**
 * `MIN_CLIENT_VERSIONS`, e.g. "ios=2.2.2,macos=2.2.2": the oldest version each
 * listed platform may be on. A platform left out has no minimum. Entries that
 * do not parse are returned apart so the caller can report them.
 */
export function parseMinimumVersions(raw: string | undefined): { minimums: MinimumVersions; invalid: string[] } {
    const minimums: MinimumVersions = {};
    const invalid: string[] = [];
    for (const entry of (raw ?? "").split(",")) {
        if (!entry.trim()) continue;
        const [platform, version] = entry.split("=").map((part) => part.trim());
        if (isClientPlatform(platform) && isVersion(version)) minimums[platform] = version;
        else invalid.push(entry.trim());
    }
    return { minimums, invalid };
}

/**
 * True when the server no longer serves this client. A browser tab that sends
 * no version is left alone: it cannot be told apart from any other caller,
 * and a reload is all it would ever need.
 */
export function isBelowMinimum(client: ClientInfo, minimums: MinimumVersions): boolean {
    if (client.platform === "unknown") return false;
    const minimum = minimums[client.platform];
    if (!minimum) return false;
    if (!client.version) return client.native;
    return compareVersions(client.version, minimum) < 0;
}

/**
 * The versions counted under a label of their own: the release tags
 * (`RELEASED_VERSIONS`, comma-separated, set when the image is built) and the
 * server's own version, which is tagged only once it is released. Every store
 * build waits on the server's deploy, so no real build is newer than it.
 */
export function parseReleasedVersions(raw: string | undefined, own: string | undefined): Set<string> {
    return new Set([...(raw ?? "").split(",").map((entry) => entry.trim()), own].filter(isVersion));
}

/**
 * The version label to count a request under. Each label is a time series,
 * held in memory by this server and by Prometheus, and a request can claim
 * any version it likes, so only released versions get a label of their own:
 * any other is counted as OTHER_VERSIONS.
 */
export const versionLabel = (version: string | null, released: ReadonlySet<string>): string =>
    !version ? UNVERSIONED : released.has(version) ? version : OTHER_VERSIONS;
