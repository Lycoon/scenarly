import { SignJWT } from "jose";

import * as bc from "lib0/broadcastchannel";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { CURRENT_PROJECT_VERSION } from "../project/migrations/project-migrations";

declare const window: Window & typeof globalThis;

/**
 * This custom WebsocketProvider enables adaptive throttle depending on how many collaborators are currently
 * working on the project to save bandwidth. While updates are more sparse for a single-user, they are more
 * frequent during multi-user editing.
 */
type WebsocketProviderOptions = {
    connect?: boolean;
    awareness?: awarenessProtocol.Awareness;
    params?: Record<string, string>;
    WebSocketPolyfill?: typeof WebSocket;
    resyncInterval?: number;
    maxBackoffTime?: number;
    disableBc?: boolean;
};

/** A fresh cloud token; `forbidden` when the user no longer has access to the project. */
export type CloudTokenFetcher = () => Promise<{ token: string | null; forbidden: boolean }>;

type WSInternals = {
    _updateHandler: (update: Uint8Array, origin: unknown) => void;
    _awarenessUpdateHandler: (
        changes: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
    ) => void;
    messageHandlers: Array<(encoder: encoding.Encoder, ...rest: unknown[]) => void>;
    ws: WebSocket | null;
    bcconnected: boolean;
    bcChannel: string;
    wsUnsuccessfulReconnects: number;
};

export class ThrottledWebsocketProvider extends WebsocketProvider {
    on(event: "document-restored", listener: () => void): this;
    on(event: "stale-client-version", listener: () => void): this;
    on(event: "session-replaced", listener: () => void): this;
    on(event: "kicked", listener: () => void): this;
    on(event: "role-changed", listener: (role: string) => void): this;
    on(event: "lock-changed", listener: (locked: boolean) => void): this;
    on(event: Parameters<WebsocketProvider["on"]>[0], listener: Parameters<WebsocketProvider["on"]>[1]): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(
            event as unknown as Parameters<WebsocketProvider["on"]>[0],
            listener as unknown as Parameters<WebsocketProvider["on"]>[1],
        ) as unknown as this;
    }

    emit(event: "document-restored", args: []): this;
    emit(event: "stale-client-version", args: []): this;
    emit(event: "session-replaced", args: []): this;
    emit(event: "kicked", args: []): this;
    emit(event: "role-changed", args: [string]): this;
    emit(event: "lock-changed", args: [boolean]): this;
    emit(event: Parameters<WebsocketProvider["emit"]>[0], args: Parameters<WebsocketProvider["emit"]>[1]): this;
    emit(event: string, args: unknown[]): this {
        super.emit(
            event as unknown as Parameters<WebsocketProvider["emit"]>[0],
            args as unknown as Parameters<WebsocketProvider["emit"]>[1],
        );
        return this;
    }

    off(event: "document-restored", listener: () => void): this;
    off(event: "stale-client-version", listener: () => void): this;
    off(event: "session-replaced", listener: () => void): this;
    off(event: "kicked", listener: () => void): this;
    off(event: "role-changed", listener: (role: string) => void): this;
    off(event: "lock-changed", listener: (locked: boolean) => void): this;
    off(event: Parameters<WebsocketProvider["off"]>[0], listener: Parameters<WebsocketProvider["off"]>[1]): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    off(event: string, listener: (...args: any[]) => void): this {
        return super.off(
            event as unknown as Parameters<WebsocketProvider["off"]>[0],
            listener as unknown as Parameters<WebsocketProvider["off"]>[1],
        ) as unknown as this;
    }
    private updateQueue: Uint8Array[] = [];
    private awarenessQueue: Set<number> = new Set();
    private flushInterval: ReturnType<typeof setInterval> | null = null;
    private lastFlushTime: number = 0; // Milliseconds (Date.now())
    private lastMessageTime: number = 0; // Milliseconds (Date.now())
    private hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    // Cap the queue so a long disconnect can't grow it without bound. The
    // local Yjs doc is the source of truth — on reconnect, syncStep1/2 will
    // re-converge state regardless of what's in the queue.
    private readonly MAX_UPDATE_QUEUE = 1000;

    // Throttling configuration (all in milliseconds)
    private readonly SOLO_USER_UPDATE_MS = 1000; // 1s when alone
    private readonly MULTI_USER_UPDATE_MS = 200; // 200ms with others
    private readonly MAX_SILENCE_DURATION_MS = 20000; // 20s max silence before ping
    private readonly MAX_HIDDEN_DURATION_MS = 10 * 60 * 1000; // Disconnect after 10 minutes hidden
    private readonly TOKEN_REFRESH_TIMEOUT_MS = 5000; // How long a returning user waits for a fresh token
    private readonly FLUSH_CHECK_INTERVAL_MS = 100; // Check flush every 100ms

    private isDestroyed: boolean = false;

    // Track our own state
    private readonly localClientId: number;
    private isPaused: boolean = false;
    private isResuming: boolean = false;
    private isSessionReplaced: boolean = false;
    private isStaleClient: boolean = false;
    private isKicked: boolean = false;
    private isDocumentRestored: boolean = false;
    private lastKnownUserCount: number = 1;

    // Store userInfo so we can restore it on reconnection
    private userInfo: { name: string; color: string; userId?: string } | null = null;

    private readonly fetchToken: CloudTokenFetcher | null;
    private pendingTokenRefresh: Promise<boolean> | null = null;

    // Close codes from server
    private readonly CLOSE_CODE_SESSION_REPLACED = 4001;
    private readonly CLOSE_CODE_KICKED = 4003;
    private readonly CLOSE_CODE_DOCUMENT_RESTORED = 4005;
    private readonly CLOSE_CODE_STALE_CLIENT_VERSION = 4006;

    // Bound event handlers for proper cleanup
    private boundHandleUserInput: (event: Event) => void;
    private boundHandleVisibility: () => void;
    private boundHandleOnline: () => void;

    constructor(
        serverUrl: string,
        room: string,
        doc: Y.Doc,
        options: WebsocketProviderOptions & {
            userInfo?: { name: string; color: string; userId?: string };
            fetchToken?: CloudTokenFetcher;
        },
    ) {
        // Pass connect: false to prevent immediate connection
        // We'll connect after setting up user info.
        // Always advertise the client's project schema version via `params`
        // so the DO can refuse stale-bundle connections that would write back
        // a pre-migration shape and corrupt the doc.
        const params: { [x: string]: string } = {
            ...(options.params ?? {}),
            clientVersion: String(CURRENT_PROJECT_VERSION),
        };
        // A visible client retries for as long as it is open, so let the backoff
        // grow well past y-websocket's 2.5s: an outage must not be hammered.
        super(serverUrl, room, doc, { maxBackoffTime: 30_000, ...options, params, connect: false } as unknown as ConstructorParameters<
            typeof WebsocketProvider
        >[3]);

        this.localClientId = doc.clientID;
        this.fetchToken = options.fetchToken ?? null;
        this.boundHandleUserInput = this.handleUserInput.bind(this);
        this.boundHandleVisibility = this.handleVisibilityChange.bind(this);
        this.boundHandleOnline = this.handleOnline.bind(this);
        this.lastFlushTime = Date.now();
        this.lastMessageTime = Date.now();

        // Store and set user info BEFORE connecting so awareness is correct from the start
        if (options.userInfo) {
            this.userInfo = options.userInfo;
            const currentState = this.awareness.getLocalState() || {};
            this.awareness.setLocalState({ ...currentState, user: options.userInfo });
        }

        // Replace default handlers with throttled versions
        doc.off("update", (this as unknown as WSInternals)._updateHandler);
        doc.on("update", this.onThrottledUpdate);
        this.awareness.off("update", (this as unknown as WSInternals)._awarenessUpdateHandler);
        this.awareness.on("update", this.onThrottledAwareness);

        // Handle awareness query (message type 3 = messageQueryAwareness)
        // When the server requests awareness, immediately send our current state
        (this as unknown as WSInternals).messageHandlers[3] = (encoder: encoding.Encoder) => {
            this.lastMessageTime = Date.now();
            // Write awareness update to the encoder (y-websocket will send it)
            encoding.writeVarUint(encoder, 1); // messageAwareness
            encoding.writeVarUint8Array(
                encoder,
                awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.localClientId]),
            );
        };

        // Handle ping responses (message type 9)
        // This prevents the default handler from treating it as unknown
        // and updates our message timestamp
        (this as unknown as WSInternals).messageHandlers[9] = () => {
            this.lastMessageTime = Date.now();
        };

        // Custom message type 100 — server pushes the user's new role when an
        // admin changes it. The DO has already updated its in-memory SessionInfo
        // (so the server-side write gate is correct on the next message); this
        // handler propagates the change to the UI so editor affordances flip
        // immediately, without waiting for an SWR revalidation.
        (this as unknown as WSInternals).messageHandlers[100] = (_encoder, ...rest: unknown[]) => {
            this.lastMessageTime = Date.now();
            const decoder = rest[0] as decoding.Decoder;
            try {
                const role = decoding.readVarString(decoder);
                this.emit("role-changed", [role]);
            } catch (e) {
                console.warn("[WS] Failed to read role-changed message:", e);
            }
        };

        // Custom message type 101 — the room's lock state: 1 while the owner's
        // Cloud plan has lapsed and the room drops every write, 0 once it is
        // back. Sent on connect when locked and whenever it changes.
        (this as unknown as WSInternals).messageHandlers[101] = (_encoder, ...rest: unknown[]) => {
            this.lastMessageTime = Date.now();
            const decoder = rest[0] as decoding.Decoder;
            try {
                this.emit("lock-changed", [decoding.readVarUint(decoder) === 1]);
            } catch (e) {
                console.warn("[WS] Failed to read lock-changed message:", e);
            }
        };

        // Handle connection status changes
        this.on("status", this.onStatusChange);
        this.on("connection-error", this.onConnectionError);

        // Start background processes
        this.startFlushLoop();
        this.setupPresenceListeners();

        // Hook into WebSocket close events to detect session replacement
        this.setupCloseHandler();

        console.log(`[WS] Provider initialized for room ${room}, clientId: ${this.localClientId}`);

        // Now connect after everything is set up (including user info)
        this.connect();
    }

    /**
     * Handle connection status changes
     */
    private onStatusChange = (event: { status: string }) => {
        if (event.status === "connected") {
            this.lastMessageTime = Date.now();

            // Until its user acts, any later reconnection is this client's own doing
            this.setAutomaticReconnect(true);

            // Set our state again even if it survived the disconnect: the room may
            // have removed it meanwhile, and only takes it back with a newer clock.
            const localState = this.awareness.getLocalState() ?? {};
            this.awareness.setLocalState(this.userInfo ? { ...localState, user: this.userInfo } : localState);

            // Queue and send our awareness update
            this.awarenessQueue.add(this.localClientId);
            this.flush();
        } else if (event.status === "disconnected") {
            this.lastKnownUserCount = 1;
        }
    };

    /**
     * Set up a hook to intercept WebSocket close events
     * y-websocket doesn't expose close codes, so we need to intercept
     */
    private setupCloseHandler(): void {
        let currentWs: WebSocket | null = null;

        const checkAndHookWs = () => {
            const ws = (this as unknown as WSInternals).ws;
            if (ws && ws !== currentWs) {
                currentWs = ws;
                const originalClose = ws.onclose;
                ws.onclose = (event: CloseEvent) => {
                    // A socket we already moved on from says nothing about the current one
                    const isCurrent = (this as unknown as WSInternals).ws === ws;
                    if (isCurrent && event.code === this.CLOSE_CODE_SESSION_REPLACED) {
                        this.handleSessionReplaced();
                        return;
                    }
                    if (isCurrent && event.code === this.CLOSE_CODE_KICKED) {
                        this.handleKicked();
                        return;
                    }
                    if (isCurrent && event.code === this.CLOSE_CODE_DOCUMENT_RESTORED) {
                        this.handleDocumentRestored();
                        return;
                    }
                    if (isCurrent && event.code === this.CLOSE_CODE_STALE_CLIENT_VERSION) {
                        this.handleStaleClientVersion();
                        return;
                    }
                    if (originalClose) {
                        originalClose.call(ws, event);
                    }
                };
            }
        };

        // Hook into new WebSocket connections when status changes
        this.on("status", (event: { status: string }) => {
            if (event.status === "connecting") {
                setTimeout(checkAndHookWs, 0);
            }
        });

        // Initial check
        checkAndHookWs();
    }

    /**
     * Handle session replacement: the user opened the project on another device
     * (or tab), which holds their one connection now. Stop reconnecting until
     * they act here again (see handleUserInput and handleVisibilityChange).
     */
    private handleSessionReplaced(): void {
        console.log("[WS] Session was replaced by another connection. Stopping reconnection.");
        this.isSessionReplaced = true;

        this.shouldConnect = false;
        this.disconnect();
        this.emit("session-replaced", []);
    }

    /**
     * Handle document restore — the server replaced its doc with a snapshot.
     * Stop reconnecting and notify the consumer to clear local state and reload.
     */
    private handleDocumentRestored(): void {
        console.log("[WS] Document was restored. Notifying consumer to reload.");
        // Reconnecting before the reload would push the pre-restore document back
        this.isDocumentRestored = true;

        this.shouldConnect = false;
        this.disconnect();
        this.emit("document-restored", []);
    }

    /**
     * Handle kick close (4003) — the user was removed from the project. Stop
     * reconnecting (the cloud token endpoint will reject us with 403 forever)
     * and notify the consumer to surface the project-unavailable dialog.
     */
    private handleKicked(): void {
        console.log("[WS] User was kicked from the project. Stopping reconnection.");
        this.isKicked = true;

        this.shouldConnect = false;
        this.disconnect();
        this.emit("kicked", []);
    }

    public get wasKicked(): boolean {
        return this.isKicked;
    }

    /**
     * Handle stale-client-version close — this client's bundle is older than
     * the project's schema version. Stop reconnecting (would just be rejected
     * again) and notify the consumer to prompt the user to update.
     */
    private handleStaleClientVersion(): void {
        console.warn("[WS] Client version is stale. Notifying consumer to prompt update.");
        this.isStaleClient = true;

        this.shouldConnect = false;
        this.disconnect();
        this.emit("stale-client-version", []);
    }

    public get wasStaleClient(): boolean {
        return this.isStaleClient;
    }

    /**
     * Count active collaborators (excluding ourselves and stale states)
     * Only counts users who have set a 'user' field in their awareness state
     */
    private getActiveUserCount(): number {
        const states = this.awareness.getStates();
        let count = 0;

        states.forEach((state, clientId) => {
            // Only count if:
            // 1. It's not our own client
            // 2. The state has a 'user' field (indicating active collaboration)
            if (clientId !== this.localClientId && state && state.user) {
                count++;
            }
        });

        // Include ourselves in the count
        const totalCount = count + 1;

        // Log when user count changes
        if (totalCount !== this.lastKnownUserCount) {
            console.log(`[WS] Active user count changed: ${this.lastKnownUserCount} -> ${totalCount}`);
            this.lastKnownUserCount = totalCount;
        }

        return totalCount;
    }

    /**
     * Update the user info for awareness.
     * This stores the info and sets it on the awareness state.
     */
    public setUserInfo(userInfo: { name: string; color: string; userId?: string }): void {
        this.userInfo = userInfo;
        const currentState = this.awareness.getLocalState() || {};
        this.awareness.setLocalState({ ...currentState, user: userInfo });
    }

    /** Use a newer token from the next connection on. */
    public updateToken(newToken: string): void {
        this.params = { ...this.params, token: newToken };
    }

    /** Whether nothing holds this client back from being connected. */
    private get mayConnect(): boolean {
        return (
            !this.isDestroyed &&
            !this.isPaused &&
            !this.isSessionReplaced &&
            !this.isKicked &&
            !this.isStaleClient &&
            !this.isDocumentRestored
        );
    }

    /**
     * Tell the room whether the next connection is the client's own doing. Such
     * a connection yields to a live one on another of the user's devices, while
     * one the user caused takes over from it.
     */
    private setAutomaticReconnect(isAutomatic: boolean): void {
        const params = { ...this.params };
        delete params.resume;
        this.params = isAutomatic ? { ...params, resume: "1" } : params;
    }

    /**
     * Fetch a new token and use it from the next connection on. One at a time:
     * concurrent callers share the request.
     *
     * @returns whether connecting is still worth trying: false once the user
     * has lost access. A failed request keeps the current token.
     */
    private refreshToken(): Promise<boolean> {
        const { fetchToken } = this;
        if (!fetchToken) return Promise.resolve(true);
        this.pendingTokenRefresh ??= (async () => {
            try {
                const { token, forbidden } = await fetchToken();
                if (this.isDestroyed) return false;
                if (forbidden) {
                    this.handleKicked();
                    return false;
                }
                if (token) this.updateToken(token);
            } catch (e) {
                console.warn("[WS] Failed to refresh token:", e);
            } finally {
                this.pendingTokenRefresh = null;
            }
            return true;
        })();
        return this.pendingTokenRefresh;
    }

    /**
     * A connection attempt failed, possibly over an expired token. y-websocket
     * keeps retrying by itself and picks the new token up.
     */
    private onConnectionError = (): void => {
        // Closing a socket that is still connecting errors too, so this also
        // runs right after we stopped on purpose.
        if (!this.mayConnect || !this.shouldConnect) return;
        void this.refreshToken();
    };

    /** Drop the current connection or attempt, if any, and connect again now. */
    private reconnect(): void {
        if (!this.mayConnect) return;
        // Plain connect() is a no-op while an attempt is pending, even a hung one.
        this.disconnect();
        (this as unknown as WSInternals).wsUnsuccessfulReconnects = 0;
        this.connect();
    }

    /**
     * Connect after a pause or a replacement, now that the user is back.
     *
     * The token is renewed first: it may have expired, and it carries the role
     * the user had when it was issued, while role changes are only pushed to
     * connected clients.
     */
    private async resume(): Promise<void> {
        if (this.isResuming || this.isDestroyed || this.isKicked || this.isStaleClient || this.isDocumentRestored) {
            return;
        }
        this.isResuming = true;
        try {
            const canConnect = await Promise.race([
                this.refreshToken(),
                new Promise<boolean>((resolve) => setTimeout(() => resolve(true), this.TOKEN_REFRESH_TIMEOUT_MS)),
            ]);
            if (!canConnect) return;
            this.isPaused = false;
            this.isSessionReplaced = false;
            this.setAutomaticReconnect(false);
            this.reconnect();
        } finally {
            this.isResuming = false;
        }
    }

    /**
     * Follow whether the user is there: the page being shown or hidden, the
     * network coming back, and input (to take over from another device).
     */
    private setupPresenceListeners(): void {
        if (typeof window === "undefined") return;

        // Capturing, so that no component can keep the event from us.
        window.addEventListener("pointerdown", this.boundHandleUserInput, { passive: true, capture: true });
        window.addEventListener("keydown", this.boundHandleUserInput, { passive: true, capture: true });
        document.addEventListener("visibilitychange", this.boundHandleVisibility);
        window.addEventListener("online", this.boundHandleOnline);

        if (document.visibilityState === "hidden") this.startHiddenTimer();
    }

    private startHiddenTimer(): void {
        this.stopHiddenTimer();
        this.hiddenTimer = setTimeout(() => this.pause(), this.MAX_HIDDEN_DURATION_MS);
    }

    private stopHiddenTimer(): void {
        if (!this.hiddenTimer) return;
        clearTimeout(this.hiddenTimer);
        this.hiddenTimer = null;
    }

    /**
     * Disconnect because the page has been hidden for long. A visible page stays
     * connected for as long as it is open, whether its user types or just reads.
     */
    private pause(): void {
        this.hiddenTimer = null;
        // A suspended app runs its timers late, once it is back on screen.
        if (document.visibilityState !== "hidden" || !this.mayConnect) return;

        console.log("[WS] Hidden for too long. Closing connection to save resources.");
        this.isPaused = true;

        if (this.wsconnected) {
            // Both reach the server: a socket sends what it holds before closing
            this.cleanupLocalAwareness();
            this.flush();
        }

        // Also stops y-websocket's own reconnect loop, when already disconnected
        this.disconnect();
    }

    private handleVisibilityChange(): void {
        if (this.isDestroyed) return;
        if (document.visibilityState === "hidden") {
            // The page may be suspended or killed before the flush loop runs again
            if (this.wsconnected) this.flush();
            this.startHiddenTimer();
            return;
        }

        this.stopHiddenTimer();
        if (this.isPaused || this.isSessionReplaced) {
            void this.resume();
        } else if (!this.wsconnected && !this.isResuming) {
            this.reconnect();
        }
    }

    /** The network is back. Not a sign of the user: a pause or replacement stands. */
    private handleOnline(): void {
        if (!this.wsconnected && !this.isResuming) this.reconnect();
    }

    /** The user acts here again: take over from the device that replaced this one. */
    private handleUserInput(event: Event): void {
        if (!this.isSessionReplaced) return;
        // A modifier alone is usually on its way to another window
        if (["Meta", "Control", "Alt", "Shift"].includes((event as KeyboardEvent).key)) return;
        void this.resume();
    }

    private cleanupPresenceListeners(): void {
        if (typeof window === "undefined") return;

        window.removeEventListener("pointerdown", this.boundHandleUserInput, { capture: true });
        window.removeEventListener("keydown", this.boundHandleUserInput, { capture: true });
        document.removeEventListener("visibilitychange", this.boundHandleVisibility);
        window.removeEventListener("online", this.boundHandleOnline);
        this.stopHiddenTimer();
    }

    /**
     * Clean up local awareness state
     * Call this before disconnecting to ensure other clients are notified
     */
    private cleanupLocalAwareness(): void {
        try {
            // Remove our awareness state
            awarenessProtocol.removeAwarenessStates(this.awareness, [this.localClientId], "local cleanup");

            // Immediately send the removal if connected
            if (this.wsconnected && this.ws && this.ws.readyState === 1) {
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, 1); // awareness message type
                encoding.writeVarUint8Array(
                    encoder,
                    awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.localClientId]),
                );
                this.ws.send(encoding.toUint8Array(encoder));
            }

            console.log(`[WS] Cleaned up local awareness for clientId: ${this.localClientId}`);
        } catch (e) {
            console.warn("[WS] Failed to cleanup local awareness:", e);
        }
    }

    /**
     * Handle document updates (throttled)
     */
    private onThrottledUpdate = (update: Uint8Array, origin: unknown): void => {
        if (origin === this) return;

        // Read-only short-circuit: when the local doc is in viewer mode, the
        // ProjectState rollback guard reverts every local write immediately.
        // Both the original write and the inverse op fire `update` events, but
        // the server would drop them anyway (protocol.ts blocks viewer writes).
        // Skip the queue entirely to save bandwidth and keep the WS quiet.
        const ydoc = this.doc as { isReadOnly?: boolean };
        if (ydoc.isReadOnly) return;

        // An edit the cloud lacks must get there, even if another device of the
        // user is connected by then: don't yield to it.
        if (!this.wsconnected) this.setAutomaticReconnect(false);

        this.updateQueue.push(update);
        // Cap queue length on long disconnects. The local doc still holds
        // every change; sync on reconnect will replay them.
        if (this.updateQueue.length > this.MAX_UPDATE_QUEUE) {
            this.updateQueue.splice(0, this.updateQueue.length - this.MAX_UPDATE_QUEUE);
        }
    };

    /**
     * Handle awareness updates (throttled)
     */
    private onThrottledAwareness = (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
    ): void => {
        if (origin !== this) {
            const changedClients = [...added, ...updated, ...removed];

            for (const clientId of changedClients) {
                this.awarenessQueue.add(clientId);
            }

            // If user joins or leaves (not just cursor move), send immediately
            if (added.length > 0 || removed.length > 0) {
                this.flush();
            }
        }
    };

    /**
     * Start the periodic flush check loop
     */
    private startFlushLoop(): void {
        this.flushInterval = setInterval(() => {
            this.checkAndFlush();
        }, this.FLUSH_CHECK_INTERVAL_MS);
    }

    /**
     * Check if we should flush and handle connection keepalive
     */
    private checkAndFlush(): void {
        if (this.isDestroyed || !this.wsconnected) return;

        const now = Date.now();

        // Check if we have pending updates to send
        if (this.updateQueue.length > 0 || this.awarenessQueue.size > 0) {
            const userCount = this.getActiveUserCount();
            const requiredDelay = userCount <= 1 ? this.SOLO_USER_UPDATE_MS : this.MULTI_USER_UPDATE_MS;

            const timeSinceLastFlush = now - this.lastFlushTime;

            if (timeSinceLastFlush >= requiredDelay) {
                this.flush();
            }
        }

        // Send ping if we haven't received any messages for too long
        const timeSinceLastMessage = now - this.lastMessageTime;

        if (timeSinceLastMessage > this.MAX_SILENCE_DURATION_MS) {
            this.sendPing();
            // Update to prevent ping spam, actual update happens in onMessageReceived
            this.lastMessageTime = now;
        }
    }

    /**
     * Flush all pending updates to the server and BroadcastChannel.
     *
     * Queues are only cleared if at least one transport (WS or BC) actually
     * delivered the message. Otherwise the entries stay queued for the next
     * flush — important when the WS is mid-reconnect: the previous code
     * dropped the queue regardless, relying on Yjs re-sync to recover.
     */
    public flush(): void {
        const ws = this.ws;
        const internals = this as unknown as WSInternals;
        const isWsConnected = this.wsconnected && !!ws && ws.readyState === 1;
        const isBcConnected = internals.bcconnected;
        const canDeliver = isWsConnected || isBcConnected;

        // Send document updates
        if (this.updateQueue.length > 0 && canDeliver) {
            try {
                const updates = this.updateQueue;
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, 0); // sync message type
                for (const update of updates) {
                    syncProtocol.writeUpdate(encoder, update);
                }
                const message = encoding.toUint8Array(encoder);

                if (isWsConnected) {
                    ws.send(message);
                }
                if (isBcConnected) {
                    bc.publish(internals.bcChannel, message, this);
                }
                this.updateQueue = [];
            } catch (e) {
                console.error("[WS] Failed to send document updates:", e);
            }
        }

        // Send awareness updates
        if (this.awarenessQueue.size > 0 && canDeliver) {
            try {
                const changedClients = Array.from(this.awarenessQueue);
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, 1); // awareness message type
                encoding.writeVarUint8Array(
                    encoder,
                    awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
                );
                const message = encoding.toUint8Array(encoder);

                if (isWsConnected) {
                    ws.send(message);
                }
                if (isBcConnected) {
                    bc.publish(internals.bcChannel, message, this);
                }
                this.awarenessQueue.clear();
            } catch (e) {
                console.error("[WS] Failed to send awareness updates:", e);
            }
        }

        this.lastFlushTime = Date.now();
    }

    /**
     * Send a ping to keep the connection alive
     */
    private sendPing(): void {
        if (!this.wsconnected || !this.ws || this.ws.readyState !== 1) return;

        try {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, 9); // ping message type
            this.ws.send(encoding.toUint8Array(encoder));
        } catch (e) {
            console.warn("[WS] Failed to send ping:", e);
        }
    }

    /**
     * Check if currently connected
     */
    public get isConnected(): boolean {
        return this.wsconnected && this.ws?.readyState === 1;
    }

    /**
     * Check if session was replaced by another connection (same user connected elsewhere)
     */
    public get wasSessionReplaced(): boolean {
        return this.isSessionReplaced;
    }

    /**
     * Destroy the provider and clean up all resources
     */
    destroy(): void {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        // Stop the flush loop
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }

        this.cleanupPresenceListeners();

        // Clean up awareness
        this.cleanupLocalAwareness();

        // Flush any remaining updates
        this.flush();

        // Remove our event handlers
        this.doc.off("update", this.onThrottledUpdate);
        this.awareness.off("update", this.onThrottledAwareness);
        this.off("status", this.onStatusChange);
        this.off("connection-error", this.onConnectionError);

        // Call parent destroy
        super.destroy();
    }
}

/** POST a privileged action to a project's room, signed with an admin-action JWT. */
const adminAction = async (projectId: string, path: string, body?: unknown): Promise<Response> => {
    const payload = {
        type: "admin-action",
        projectId,
    };

    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1m").sign(secret);
    return fetch(`${process.env.NEXT_PUBLIC_CLOUD_URL}/${projectId}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
    });
};

export const allowOnWebsocket = async (userId: string, projectId: string) => {
    await adminAction(projectId, "/allow", { userId });
};

export const blacklistFromWebsocket = async (userId: string, projectId: string) => {
    await adminAction(projectId, "/blacklist", { userId });
};

export const notifyRoleChange = async (userId: string, projectId: string, role: string) => {
    await adminAction(projectId, "/role-update", { userId, role });
};

/**
 * Make a project's room read-only for every member, or lift that (see
 * cloud-lapse-service). Reports failure rather than throwing, so the caller
 * can retry it later instead of failing what it was doing.
 */
export const setProjectRoomLocked = async (projectId: string, locked: boolean): Promise<boolean> => {
    try {
        const res = await adminAction(projectId, "/lock", { locked });
        if (!res.ok) console.error(`[cloud] Failed to set lock=${locked} on project ${projectId}: ${res.status}`);
        return res.ok;
    } catch (e) {
        console.error(`[cloud] Failed to set lock=${locked} on project ${projectId}:`, e);
        return false;
    }
};

/**
 * Wipe a project's Durable Object storage and every R2 snapshot it holds.
 * Best-effort: a Worker outage must not block the DB-side deletion, so this
 * reports failure instead of throwing (the caller logs and carries on).
 */
export const purgeProjectRoom = async (projectId: string): Promise<boolean> => {
    try {
        const res = await adminAction(projectId, "/purge");
        if (!res.ok) {
            console.error(`[cloud] Failed to purge room for project ${projectId}: ${res.status} ${await res.text()}`);
            return false;
        }
        return true;
    } catch (e) {
        console.error(`[cloud] Failed to purge room for project ${projectId}:`, e);
        return false;
    }
};
