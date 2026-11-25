import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";

import { ProjectRoom } from "@src/lib/cloud/room";

/** The room's end of a connection; survives the room's hibernation, as on Cloudflare. */
class Socket {
    readyState = 1;
    closed: number | null = null;
    sent: Uint8Array[] = [];
    private attachment: unknown = null;

    accept(): void {}
    send(data: Uint8Array): void {
        this.sent.push(data);
    }
    close(code: number): void {
        if (code !== 1000 && (code < 3000 || code > 4999)) throw new Error(`Invalid close code ${code}`);
        this.closed = code;
        this.readyState = 2;
    }
    serializeAttachment(value: unknown): void {
        this.attachment = structuredClone(value);
    }
    deserializeAttachment(): unknown {
        return this.attachment;
    }
}

// The room tells its sockets' updates from its own with `instanceof WebSocket`
Object.setPrototypeOf(Socket.prototype, WebSocket.prototype);

const g = globalThis as unknown as Record<string, unknown>;
const real = { Response: g.Response, WebSocketPair: g.WebSocketPair };
let lastServerSocket: Socket;

beforeAll(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    g.WebSocketPair = class {
        0 = {};
        1 = (lastServerSocket = new Socket());
    };
    // Browsers refuse to build a 101
    g.Response = class {
        status: number;
        constructor(_body: unknown, init?: { status?: number }) {
            this.status = init?.status ?? 200;
        }
    };
});

afterAll(() => {
    g.Response = real.Response;
    g.WebSocketPair = real.WebSocketPair;
    vi.restoreAllMocks();
});

let sockets: Socket[];
let saved: ArrayBuffer | null;

/** Build the room over the same sockets and storage: a first start, or a wake from hibernation. */
const wake = async (): Promise<ProjectRoom> => {
    const pending: Promise<unknown>[] = [];
    const ctx = {
        storage: {
            sql: {
                exec: (query: string) => {
                    const rows = query.startsWith("SELECT data FROM project") && saved ? [{ data: saved }] : [];
                    return Object.assign(rows, { toArray: () => rows });
                },
            },
            setAlarm: async () => {},
            getAlarm: async () => null,
        },
        blockConcurrencyWhile: (fn: () => Promise<unknown>) => pending.push(fn()),
        getWebSockets: () => sockets,
        acceptWebSocket: (ws: Socket) => sockets.push(ws),
    };
    const room = new ProjectRoom(ctx as never, {} as never);
    await Promise.all(pending);
    return room;
};

/** `Upgrade` is a forbidden header in browsers, so requests are plain objects. */
const request = (url: string, headers: Record<string, string>) =>
    ({ url, method: "GET", headers: { get: (k: string) => headers[k] ?? null } }) as unknown as Request;

const join = async (room: ProjectRoom, user: string, clientId: number, { resume = false, role = "EDITOR", version = 9999 } = {}) => {
    const response = await room.fetch(
        request(`https://room/?clientId=${clientId}&clientVersion=${version}${resume ? "&resume=1" : ""}`, {
            Upgrade: "websocket",
            "X-User-Id": user,
            "X-User-Role": role,
        }),
    );
    return { status: response.status, ws: lastServerSocket };
};

const message = (type: number, write: (e: encoding.Encoder) => void): ArrayBuffer => {
    const e = encoding.createEncoder();
    encoding.writeVarUint(e, type);
    write(e);
    return encoding.toUint8Array(e).slice().buffer as ArrayBuffer;
};
const announce = (room: ProjectRoom, ws: Socket, clientId: number) => {
    const doc = new Y.Doc();
    doc.clientID = clientId;
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState({ user: { name: String(clientId) } });
    const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [clientId]);
    awareness.destroy();
    return room.webSocketMessage(ws as never, message(1, (e) => encoding.writeVarUint8Array(e, update)));
};
const write = (room: ProjectRoom, ws: Socket, text: string) => {
    const doc = new Y.Doc();
    doc.getText("probe").insert(0, text);
    return room.webSocketMessage(
        ws as never,
        message(0, (e) => syncProtocol.writeUpdate(e, Y.encodeStateAsUpdate(doc))),
    );
};
const text = (room: ProjectRoom) => room.doc.getText("probe").toString();

beforeEach(() => {
    sockets = [];
    saved = null;
});

describe("after hibernation", () => {
    it("cleans up a connection that drops", async () => {
        const before = await wake();
        const ada = await join(before, "ada", 1);
        const bob = await join(before, "bob", 2);
        await announce(before, ada.ws, 1);
        await announce(before, bob.ws, 2);

        const room = await wake();
        expect(room.sessions.size).toBe(2);
        expect(room.sessions.get(bob.ws as never)?.clientIds).toEqual(new Set([2]));
        await room.webSocketClose(bob.ws as never, 1006, "", false);
        expect(room.getConnectedUsers()).toEqual(["ada"]);
        expect(room.sessions.size).toBe(1);
    });

    it("lets a user back in while their old socket lingers", async () => {
        const before = await wake();
        const old = await join(before, "ada", 1);
        await announce(before, old.ws, 1);

        const room = await wake();
        const back = await join(room, "ada", 2);
        expect(back.status).toBe(101);
        expect(old.ws.closed).toBe(4001);
        expect(room.sessions.size).toBe(1);
    });

    it("doesn't bring back connections that ended", async () => {
        const before = await wake();
        const old = await join(before, "ada", 1);
        const bob = await join(before, "bob", 2);
        await join(before, "ada", 3); // replaces the first
        old.ws.readyState = 1; // its close has yet to go through
        bob.ws.readyState = 2; // closing

        const room = await wake();
        expect(room.getConnectedUsers()).toEqual(["ada"]);
        expect(room.sessions.size).toBe(1);
    });
});

describe("ending a connection", () => {
    it.each([
        [1000, 1000],
        [1001, 1000],
        [1005, 1000],
        [1006, 1000],
        [4001, 4001],
    ])("answers a close with code %i by %i", async (code, answer) => {
        const room = await wake();
        const { ws } = await join(room, "ada", 1);
        await room.webSocketClose(ws as never, code, "", true);
        expect(ws.closed).toBe(answer);
        expect(room.sessions.size).toBe(0);
    });

    it("tells the others, once", async () => {
        const room = await wake();
        const ada = await join(room, "ada", 1);
        const bob = await join(room, "bob", 2);
        await announce(room, ada.ws, 1);
        await announce(room, bob.ws, 2);
        ada.ws.sent = [];
        await room.webSocketClose(bob.ws as never, 1000, "", true);
        await room.webSocketClose(bob.ws as never, 1000, "", true);
        expect(ada.ws.sent).toHaveLength(1);
        expect(new TextDecoder().decode(ada.ws.sent[0])).toContain("null");
    });

    it("forgets a connection that errors", async () => {
        const room = await wake();
        const { ws } = await join(room, "ada", 1);
        await room.webSocketError(ws as never, new Error("Network connection lost"));
        expect(room.sessions.size).toBe(0);
    });

    it("drops writes still in flight from a replaced viewer", async () => {
        const room = await wake();
        const old = await join(room, "vic", 1, { role: "VIEWER" });
        await join(room, "vic", 2, { role: "VIEWER" });
        await write(room, old.ws, "not mine to write");
        expect(text(room)).toBe("");
    });
});

describe("one connection per user", () => {
    it("goes to the device used last", async () => {
        const room = await wake();
        const desktop = await join(room, "ada", 1);
        const phone = await join(room, "ada", 2);
        expect(desktop.ws.closed).toBe(4001);
        expect(phone.ws.closed).toBeNull();

        const desktopAgain = await join(room, "ada", 1);
        expect(phone.ws.closed).toBe(4001);
        expect(desktopAgain.ws.closed).toBeNull();
        expect(room.sessions.size).toBe(1);
        await write(room, desktopAgain.ws, "hello");
        expect(text(room)).toBe("hello");
    });

    it("isn't taken by a device reconnecting by itself", async () => {
        const room = await wake();
        const phone = await join(room, "ada", 2);
        const desktop = await join(room, "ada", 1, { resume: true });
        expect(desktop.status).toBe(101);
        expect(desktop.ws.closed).toBe(4001);
        // A hibernatable socket closed before the response never delivers its close
        expect(sockets).toEqual([phone.ws]);
        expect(phone.ws.closed).toBeNull();
        await write(room, phone.ws, "still here");
        expect(text(room)).toBe("still here");
    });

    it("lets a device reconnect over its own dead connection", async () => {
        const room = await wake();
        const old = await join(room, "ada", 1);
        const back = await join(room, "ada", 1, { resume: true });
        expect(old.ws.closed).toBe(4001);
        expect(back.ws.closed).toBeNull();
    });

    it("doesn't hold on to a device gone silent", async () => {
        const room = await wake();
        const phone = await join(room, "ada", 2);
        room.sessions.get(phone.ws as never)!.lastActivity -= 61_000;
        const desktop = await join(room, "ada", 1, { resume: true });
        expect(desktop.ws.closed).toBeNull();
    });

    it("stays with the current device when the other one is outdated", async () => {
        const room = await wake();
        const phone = await join(room, "ada", 2);
        const desktop = await join(room, "ada", 1, { version: 0 });
        expect(desktop.ws.closed).toBe(4006);
        expect(sockets).toEqual([phone.ws]);
        expect(phone.ws.closed).toBeNull();
    });

    it("keeps different users apart", async () => {
        const room = await wake();
        const ada = await join(room, "ada", 1);
        await join(room, "bob", 2);
        expect(ada.ws.closed).toBeNull();
        expect(room.sessions.size).toBe(2);
    });
});
