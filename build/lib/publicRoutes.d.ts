import type { NextFunction, Request, RequestHandler, Response } from 'express';
/**
 * Paths that web extensions answer without the authentication of web.
 *
 * Some clients bring credentials that web does not know: an MCP client with the static token of an
 * extension, a webhook with a signature. With authentication enabled they never reach the extension -
 * the OAuth2 layer answers every bearer token it did not issue itself with 401, and the login check sends
 * everything else to the login page. An extension names such paths in `publicRoutes()` and protects them
 * itself.
 *
 * The limits keep this to the extension's own paths:
 * - a path lies below the adapter name of the extension (`/aura/mcp` for `aura.0`), so it can neither take
 *   over a page of another adapter nor `/login`, `/oauth` or `/.well-known`;
 * - only the handler of the extension answers it. When the handler calls `next()`, the request goes on
 *   through the normal chain and needs the usual login, so nothing of web itself becomes reachable.
 */
/** A path that a web extension answers itself, without the authentication of web */
export interface PublicRoute {
    /** `/<adapter name>` or a path below it, like `/aura/mcp`. Matches itself and everything below it */
    path: string;
    /**
     * Answers the request. It gets the request as it came in: in front of the body parsers, the session and
     * the login, so there is no `req.body`, no session and no `req.user`. Calling `next()` hands the request
     * back to web, which then asks for the usual login.
     */
    handler: (req: Request, res: Response, next: NextFunction) => unknown;
}
interface Logger {
    info(message: string): void;
    warn(message: string): void;
}
/**
 * The path as it is matched, or why it is refused
 *
 * @param path the path the extension named
 * @param adapterName the name of the extension's adapter, e.g. `aura`
 */
export declare function checkPublicPath(path: unknown, adapterName: string): {
    path: string;
} | {
    error: string;
};
/** The public paths of all extensions of this web instance */
export declare class PublicRoutes {
    #private;
    /** @param log where accepted and refused paths are reported */
    constructor(log: Logger);
    /**
     * Take the paths one extension names. Each accepted one is logged: it is a path without the login of web.
     *
     * @param instance the extension instance, e.g. `aura.0`
     * @param routes what its `publicRoutes()` returned
     */
    add(instance: string, routes: unknown): void;
    /**
     * Drop the paths of one extension, when it is stopped
     *
     * @param instance the extension instance, e.g. `aura.0`
     */
    remove(instance: string): void;
    /**
     * The route a request path belongs to
     *
     * @param pathname the path of the request, without the query
     */
    find(pathname: string): (PublicRoute & {
        instance: string;
    }) | undefined;
    /** The middleware that hands these paths to their extension. Belongs in front of every authentication step */
    middleware(): RequestHandler;
}
export {};
