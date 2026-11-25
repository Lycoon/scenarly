import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { ThrottledWebsocketProvider, type CloudTokenFetcher } from "@src/lib/cloud/utils";

/** A server end that accepts every connection and answers pings. */
class FakeSocket {
    static all: FakeSocket[] = [];
    static accept: boolean | ((socket: FakeSocket) => boolean) = true;
    static get last(): FakeSocket {
        return FakeSocket.all[FakeSocket.all.length - 1];
    }

    binaryType = "";
    readyState = 0;
    sent: Uint8Array[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: Uint8Array }) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onclose: ((e: { code: number }) => void) | null = null;

    constructor(public url: string) {
        FakeSocket.all.push(this);
        setTimeout(() => {
            if (this.readyState !== 0) return;
            const { accept } = FakeSocket;
            if (typeof accept === "function" ? !accept(this) : !accept) return this.fail();
            this.readyState = 1;
            this.onopen?.();
        }, 5);
    }

    get query(): URLSearchParams {
        return new URL(this.url).searchParams;
    }

    send(data: Uint8Array): void {
        this.sent.push(data);
        if (data[0] === 9) this.onmessage?.({ data });
    }

    close(): void {
        if (this.readyState === 0) return this.fail();
        this.readyState = 2;
    }

    /** Closed by the server. */
    closeWith(code: number): void {
        this.readyState = 3;
        this.onclose?.({ code });
    }

    private fail(): void {
        this.readyState = 3;
        setTimeout(() => {
            this.onerror?.({});
            this.onclose?.({ code: 1006 });
        }, 0);
    }
}

const MINUTE = 60_000;
let visibility: DocumentVisibilityState = "visible";
let providers: ThrottledWebsocketProvider[] = [];

const setVisibility = (state: DocumentVisibilityState) => {
    visibility = state;
    document.dispatchEvent(new Event("visibilitychange"));
};
const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key }));
/** Vitest's async stepping yields for real on each timer, far too slow for minutes of a 100ms loop. */
const advance = async (ms: number) => {
    for (let left = ms; left > 0; left -= 50) {
        vi.advanceTimersByTime(Math.min(left, 50));
        for (let i = 0; i < 5; i++) await Promise.resolve();
    }
};

const open = (fetchToken?: CloudTokenFetcher) => {
    const doc = new Y.Doc();
    const provider = new ThrottledWebsocketProvider("ws://localhost:1", "room", doc, {
        params: { token: "first", clientId: String(doc.clientID) },
        userInfo: { name: "Ada", color: "#fff", userId: "ada" },
        WebSocketPolyfill: FakeSocket as unknown as typeof WebSocket,
        disableBc: true,
        fetchToken,
    });
    providers.push(provider);
    return { doc, provider };
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    FakeSocket.all = [];
    FakeSocket.accept = true;
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});

afterEach(() => {
    providers.forEach((p) => p.destroy());
    providers = [];
    delete (document as unknown as Record<string, unknown>).visibilityState;
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("a visible page", () => {
    it("stays connected without any input", async () => {
        const { provider } = open();
        await advance(60 * MINUTE);
        expect(provider.wsconnected).toBe(true);
        expect(FakeSocket.all).toHaveLength(1);
    });

    it("stays connected when the hidden timer fires late, back on screen", async () => {
        const { provider } = open();
        await advance(100);
        setVisibility("hidden");
        visibility = "visible"; // resumed, its event still to come
        await advance(11 * MINUTE);
        expect(provider.wsconnected).toBe(true);
    });

    it("slows its retries down to one every 30 seconds during an outage", async () => {
        FakeSocket.accept = false;
        open();
        await advance(5 * MINUTE);
        const before = FakeSocket.all.length;
        await advance(5 * MINUTE);
        expect(FakeSocket.all.length - before).toBeLessThanOrEqual(10);
        expect(FakeSocket.all.length - before).toBeGreaterThan(5);
    });
});

describe("a hidden page", () => {
    it("sends pending edits at once, and disconnects after 10 minutes", async () => {
        const { doc, provider } = open();
        await advance(2000);
        doc.getText("t").insert(0, "last words");
        const sent = FakeSocket.last.sent.length;
        setVisibility("hidden");
        expect(FakeSocket.last.sent.slice(sent).some((m) => m[0] === 0)).toBe(true);

        await advance(9 * MINUTE);
        expect(provider.wsconnected).toBe(true);
        await advance(2 * MINUTE);
        expect(provider.wsconnected).toBe(false);
        expect(provider.shouldConnect).toBe(false);
    });

    it("says it is leaving before it closes", async () => {
        const { provider } = open();
        await advance(2000);
        setVisibility("hidden");
        await advance(11 * MINUTE);
        expect(provider.awareness.getLocalState()).toBeNull();
        expect(new TextDecoder().decode(FakeSocket.last.sent.at(-1))).toContain("null");
        expect(FakeSocket.last.readyState).toBe(2);
    });

    it("doesn't wake up for the network", async () => {
        const { provider } = open();
        await advance(100);
        setVisibility("hidden");
        await advance(11 * MINUTE);
        window.dispatchEvent(new Event("online"));
        await advance(MINUTE);
        expect(provider.wsconnected).toBe(false);
        expect(FakeSocket.all).toHaveLength(1);
    });

    it("stays paused when it was still connecting", async () => {
        FakeSocket.accept = false;
        const fetchToken = vi.fn(async () => ({ token: "new", forbidden: false }));
        const { provider } = open(fetchToken);
        setVisibility("hidden");
        await advance(10 * MINUTE);
        const sockets = FakeSocket.all.length;
        const calls = fetchToken.mock.calls.length;
        await advance(10 * MINUTE);
        expect(provider.shouldConnect).toBe(false);
        expect(FakeSocket.all.length).toBe(sockets);
        expect(fetchToken.mock.calls.length).toBe(calls);
    });

    it("comes back with a fresh token, once, and is present again", async () => {
        const fetchToken = vi.fn(async () => ({ token: "second", forbidden: false }));
        const { provider } = open(fetchToken);
        await advance(100);
        setVisibility("hidden");
        await advance(11 * MINUTE);
        setVisibility("visible");
        await advance(1000);
        expect(provider.wsconnected).toBe(true);
        expect(fetchToken).toHaveBeenCalledTimes(1);
        expect(FakeSocket.all).toHaveLength(2);
        expect(FakeSocket.last.query.get("token")).toBe("second");
        expect(provider.awareness.getLocalState()?.user?.name).toBe("Ada");
    });

    it("comes back even when the token request hangs", async () => {
        const { provider } = open(() => new Promise(() => {}));
        await advance(100);
        setVisibility("hidden");
        await advance(11 * MINUTE);
        setVisibility("visible");
        await advance(6000);
        expect(provider.wsconnected).toBe(true);
    });

    it("doesn't come back to a project the user lost", async () => {
        const { provider } = open(async () => ({ token: null, forbidden: true }));
        const kicked = vi.fn();
        provider.on("kicked", kicked);
        await advance(100);
        setVisibility("hidden");
        await advance(11 * MINUTE);
        setVisibility("visible");
        await advance(MINUTE);
        expect(kicked).toHaveBeenCalledTimes(1);
        expect(provider.wsconnected).toBe(false);
    });
});

describe("a replaced session", () => {
    const replaced = async () => {
        const session = open();
        await advance(100);
        FakeSocket.last.closeWith(4001);
        await advance(5 * MINUTE);
        return session;
    };

    it("stays away until its user acts", async () => {
        const { provider } = await replaced();
        window.dispatchEvent(new Event("online"));
        window.dispatchEvent(new Event("mousemove"));
        press("Meta");
        await advance(MINUTE);
        expect(provider.wasSessionReplaced).toBe(true);
        expect(FakeSocket.all).toHaveLength(1);
    });

    it.each([
        ["a key", () => press("a")],
        ["a click", () => window.dispatchEvent(new PointerEvent("pointerdown"))],
        ["showing the page", () => setVisibility("visible")],
    ])("takes over on %s", async (_name, act) => {
        const { provider } = await replaced();
        act();
        await advance(100);
        expect(provider.wsconnected).toBe(true);
        expect(provider.wasSessionReplaced).toBe(false);
        expect(FakeSocket.last.query.has("resume")).toBe(false);
    });

    it("ignores a replacement aimed at a connection it already left", async () => {
        const { provider } = open();
        await advance(100);
        const old = FakeSocket.last;
        provider.disconnect();
        provider.connect();
        await advance(100);
        old.closeWith(4001);
        expect(provider.wsconnected).toBe(true);
        expect(provider.wasSessionReplaced).toBe(false);
    });

    it.each([
        [4003, "kicked"],
        [4005, "a restored document"],
        [4006, "a stale client"],
    ])("never reconnects after %i (%s)", async (code) => {
        open();
        await advance(100);
        FakeSocket.last.closeWith(code);
        setVisibility("hidden");
        setVisibility("visible");
        window.dispatchEvent(new Event("online"));
        press("a");
        await advance(MINUTE);
        expect(FakeSocket.all).toHaveLength(1);
    });
});

describe("reconnecting by itself", () => {
    it("says so, unless it holds edits the cloud lacks", async () => {
        const { doc } = open();
        await advance(100);
        expect(FakeSocket.last.query.has("resume")).toBe(false);

        FakeSocket.last.closeWith(1006);
        await advance(1000);
        expect(FakeSocket.last.query.get("resume")).toBe("1");

        FakeSocket.last.closeWith(1006);
        doc.getText("t").insert(0, "offline");
        await advance(1000);
        expect(FakeSocket.last.query.has("resume")).toBe(false);
    });

    it("shares one token request between failed attempts", async () => {
        FakeSocket.accept = (socket) => socket.query.get("token") === "second"; // the first has expired
        let release = () => {};
        const fetchToken = vi.fn(
            () =>
                new Promise<{ token: string; forbidden: boolean }>((resolve) => {
                    release = () => resolve({ token: "second", forbidden: false });
                }),
        );
        const { provider } = open(fetchToken);
        await advance(3000);
        expect(FakeSocket.all.length).toBeGreaterThan(2);
        expect(fetchToken).toHaveBeenCalledTimes(1);

        release();
        await advance(10_000);
        expect(FakeSocket.last.query.get("token")).toBe("second");
        expect(provider.wsconnected).toBe(true);
    });
});
