import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./api-utils";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { UserRole } from "../../generated/client/client";
import type { CookieUser } from "./types";
import { httpClientRequestsTotal, httpRequestDurationSeconds, httpRequestsTotal } from "../metrics/registry";
import {
    ClientInfo,
    isBelowMinimum,
    parseMinimumVersions,
    parseReleasedVersions,
    readClient,
    UNVERSIONED,
    UPDATE_REQUIRED_CODE,
    UPDATE_REQUIRED_STATUS,
    versionLabel,
    versionName,
} from "../client-version";

export type ApiContext = {
    routeParams: RouteParams;
    searchParams: SearchParams;
    user?: CookieUser;
};

export type AuthApiContext = ApiContext & { user: CookieUser };

export type RouteParams = Record<string, string>;
export type SearchParams = Record<string, string>;

const ID_SEGMENT = /^[0-9a-z_-]{20,}$/i;

const normalizeRoute = (pathname: string): string => {
    return pathname
        .split("/")
        .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment))
        .join("/");
};

// Read once: the environment only changes with a restart of the server.
const { minimums: MIN_CLIENT_VERSIONS, invalid: invalidMinimums } = parseMinimumVersions(
    process.env.MIN_CLIENT_VERSIONS,
);
if (invalidMinimums.length > 0) {
    console.error("[apiHandler] Ignoring MIN_CLIENT_VERSIONS entries:", invalidMinimums.join(", "));
}
const RELEASED_VERSIONS = parseReleasedVersions(
    process.env.RELEASED_VERSIONS,
    versionName(process.env.NEXT_PUBLIC_APP_VERSION),
);

/** Worker→app callbacks carry no app build, so they are neither counted nor turned away. */
const isAppRequest = (pathname: string) => !pathname.startsWith("/api/internal/");

const describeClient = (client: ClientInfo) => `${client.platform} ${client.version ?? UNVERSIONED}`;

function handleError(err: unknown, request: string, client: ClientInfo): NextResponse {
    if (err instanceof AppError) {
        // A server-side failure the code saw coming is still one to find in the logs.
        if (err.statusCode >= 500) {
            console.error(`[apiHandler] ${err.statusCode} on ${request} (${describeClient(client)}):`, err);
        }
        return NextResponse.json(
            { status: "error", message: err.message, ...(err.code && { code: err.code }) },
            { status: err.statusCode },
        );
    }
    // Only the log gets the details: an unexpected error's message (a Prisma one
    // names models and fields, and can quote the query's arguments) is not for the client.
    console.error(`[apiHandler] Unhandled error on ${request} (${describeClient(client)}):`, err);
    return NextResponse.json(
        { status: "error", message: "Something went wrong on our side. Please try again." },
        { status: 500 },
    );
}

export const apiHandler = <T extends ApiContext>(
    handler: (req: NextRequest, context: T) => Promise<unknown>,
) => {
    return async (
        req: NextRequest,
        { params }: { params?: Promise<RouteParams> | RouteParams } = {},
    ) => {
        const start = performance.now();
        const method = req.method;
        const route = normalizeRoute(req.nextUrl.pathname);
        const client = readClient(req.headers);

        const run = async (): Promise<Response> => {
            try {
                const userId = req.headers.get("x-user-id");
                const user = userId
                    ? {
                          id: userId,
                          email: req.headers.get("x-user-email") ?? "",
                          createdAt: new Date(req.headers.get("x-user-created-at") ?? 0),
                          role: (req.headers.get("x-user-role") as UserRole) ?? UserRole.USER,
                      }
                    : undefined;

                if (isAppRequest(req.nextUrl.pathname)) {
                    // Only signed-in requests count: the proxy sets the user from a verified
                    // credential, so an anonymous script cannot add to the numbers.
                    if (user) {
                        httpClientRequestsTotal.inc({
                            platform: client.platform,
                            version: versionLabel(client.version, RELEASED_VERSIONS),
                        });
                    }
                    if (isBelowMinimum(client, MIN_CLIENT_VERSIONS)) {
                        // Builds without the update screen can at best show this message.
                        throw new AppError(
                            UPDATE_REQUIRED_STATUS,
                            "This version of Scenarly is no longer supported. Please update it to keep using your account.",
                            UPDATE_REQUIRED_CODE,
                        );
                    }
                }

                const url = new URL(req.url);
                const searchParams = Object.fromEntries(url.searchParams);
                const routeParams = params ? (params instanceof Promise ? await params : params) : {};
                const context = { routeParams, searchParams, user } as T;
                const result = await handler(req, context);

                if (result instanceof Response) return result;
                return NextResponse.json(result, { status: 200 });
            } catch (err: unknown) {
                if (isRedirectError(err)) throw err;
                return handleError(err, `${method} ${route}`, client);
            }
        };

        const response = await run();
        const status = String(response.status);
        const durationSeconds = (performance.now() - start) / 1000;
        httpRequestsTotal.inc({ method, route, status });
        httpRequestDurationSeconds.observe({ method, route, status }, durationSeconds);
        return response;
    };
};
