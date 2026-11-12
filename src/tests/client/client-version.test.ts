import { describe, expect, it } from "vitest";
import {
    compareVersions,
    isBelowMinimum,
    OTHER_VERSIONS,
    parseMinimumVersions,
    parseReleasedVersions,
    readClient,
    UNVERSIONED,
    versionLabel,
    versionName,
} from "@src/lib/client-version";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const WINDOWS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/130.0";

const headers = (entries: Record<string, string>) => new Headers(entries);

describe("compareVersions", () => {
    it("compares each segment as a number", () => {
        expect(compareVersions("2.2.10", "2.2.9")).toBeGreaterThan(0);
        expect(compareVersions("2.10.0", "2.9.9")).toBeGreaterThan(0);
        expect(compareVersions("2.2.1", "2.2.2")).toBeLessThan(0);
        expect(compareVersions("2.2.2", "2.2.2")).toBe(0);
    });
});

describe("readClient", () => {
    it("takes the platform and version a build names", () => {
        const client = readClient(
            headers({ "x-client-type": "desktop", "x-client-platform": "ios", "x-client-version": "2.2.2" }),
        );
        expect(client).toEqual({ platform: "ios", version: "2.2.2", native: true });
    });

    it("reads an older native build's platform from its user agent", () => {
        expect(readClient(headers({ "x-client-type": "desktop", "user-agent": IPHONE_UA }))).toEqual({
            platform: "ios",
            version: null,
            native: true,
        });
        expect(readClient(headers({ "x-client-type": "desktop", "user-agent": WINDOWS_UA })).platform).toBe(
            "windows",
        );
    });

    it("counts a request without client headers as the web, whatever its user agent", () => {
        expect(readClient(headers({ "user-agent": IPHONE_UA }))).toEqual({
            platform: "web",
            version: null,
            native: false,
        });
    });

    it("drops a platform or version it does not know", () => {
        const client = readClient(
            headers({ "x-client-type": "desktop", "x-client-platform": "amiga", "x-client-version": "v2; drop" }),
        );
        expect(client).toEqual({ platform: "unknown", version: null, native: true });
    });
});

describe("parseMinimumVersions", () => {
    it("keeps the entries that parse and reports the others", () => {
        expect(parseMinimumVersions(" ios=2.2.2, macos = 2.2.3,tv=1.0.0,android=latest,")).toEqual({
            minimums: { ios: "2.2.2", macos: "2.2.3" },
            invalid: ["tv=1.0.0", "android=latest"],
        });
    });

    it("sets no minimum when unset", () => {
        expect(parseMinimumVersions(undefined)).toEqual({ minimums: {}, invalid: [] });
    });
});

describe("isBelowMinimum", () => {
    const minimums = { ios: "2.2.2", web: "2.3.0" };

    it("refuses a build older than its platform's minimum, and only that", () => {
        expect(isBelowMinimum({ platform: "ios", version: "2.2.1", native: true }, minimums)).toBe(true);
        expect(isBelowMinimum({ platform: "ios", version: "2.2.2", native: true }, minimums)).toBe(false);
        expect(isBelowMinimum({ platform: "android", version: "2.0.0", native: true }, minimums)).toBe(false);
    });

    it("refuses a native build too old to send its version, not an unversioned web request", () => {
        expect(isBelowMinimum({ platform: "ios", version: null, native: true }, minimums)).toBe(true);
        expect(isBelowMinimum({ platform: "web", version: null, native: false }, minimums)).toBe(false);
        expect(isBelowMinimum({ platform: "web", version: "2.2.9", native: false }, minimums)).toBe(true);
    });

    it("never refuses a client whose platform is unknown", () => {
        expect(isBelowMinimum({ platform: "unknown", version: null, native: true }, minimums)).toBe(false);
    });
});

describe("versionName", () => {
    it("drops the revision a staging build carries", () => {
        expect(versionName("2.2.2.5")).toBe("2.2.2");
        expect(versionName("2.2.2")).toBe("2.2.2");
        expect(versionName(undefined)).toBeUndefined();
    });
});

describe("parseReleasedVersions", () => {
    it("takes the release tags and the server's own version, and nothing that is not a version", () => {
        expect(parseReleasedVersions(" 2.2.0,2.2.1,,v2.1.0", "2.2.2")).toEqual(new Set(["2.2.0", "2.2.1", "2.2.2"]));
    });

    it("is empty when neither is set", () => {
        expect(parseReleasedVersions(undefined, undefined).size).toBe(0);
    });
});

describe("versionLabel", () => {
    const released = new Set(["2.2.1", "2.2.2"]);

    it("labels a released version as itself and any other as OTHER_VERSIONS", () => {
        expect(versionLabel("2.2.2", released)).toBe("2.2.2");
        expect(versionLabel("2.2.3", released)).toBe(OTHER_VERSIONS);
        expect(versionLabel("9999.0.1", released)).toBe(OTHER_VERSIONS);
    });

    it("labels a missing version apart", () => {
        expect(versionLabel(null, released)).toBe(UNVERSIONED);
    });
});
