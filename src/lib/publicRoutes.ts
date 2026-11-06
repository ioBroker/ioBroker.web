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

/** A plain path segment: no `.` or `..`, nothing encoded, no query */
const SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;

/**
 * The path as it is matched, or why it is refused
 *
 * @param path the path the extension named
 * @param adapterName the name of the extension's adapter, e.g. `aura`
 */
export function checkPublicPath(path: unknown, adapterName: string): { path: string } | { error: string } {
    if (typeof path !== 'string' || !path.startsWith('/')) {
        return { error: 'it is not a path starting with "/"' };
    }
    const segments = path.replace(/\/+$/, '').split('/').slice(1);
    if (!segments.length || segments.some(segment => !SEGMENT.test(segment))) {
        return { error: 'only plain path segments are allowed (no "." or "..", no query, nothing encoded)' };
    }
    if (segments[0] !== adapterName) {
        return { error: `it does not lie below "/${adapterName}"` };
    }
    return { path: `/${segments.join('/')}` };
}

/** The public paths of all extensions of this web instance */
export class PublicRoutes {
    readonly #routes: (PublicRoute & { instance: string })[] = [];

    readonly #log: Logger;

    /** @param log where accepted and refused paths are reported */
    constructor(log: Logger) {
        this.#log = log;
    }

    /**
     * Take the paths one extension names. Each accepted one is logged: it is a path without the login of web.
     *
     * @param instance the extension instance, e.g. `aura.0`
     * @param routes what its `publicRoutes()` returned
     */
    add(instance: string, routes: unknown): void {
        if (routes === undefined || routes === null) {
            return;
        }
        if (!Array.isArray(routes)) {
            this.#log.warn(`Extension "${instance}": publicRoutes() did not return an array - ignored`);
            return;
        }
        const adapterName = instance.split('.')[0];
        for (const route of routes as Partial<PublicRoute>[]) {
            const name = JSON.stringify(route?.path);
            if (typeof route?.handler !== 'function') {
                this.#log.warn(`Extension "${instance}": public path ${name} has no handler - ignored`);
                continue;
            }
            const checked = checkPublicPath(route.path, adapterName);
            if ('error' in checked) {
                this.#log.warn(`Extension "${instance}": public path ${name} is refused, ${checked.error}`);
                continue;
            }
            const taken = this.#routes.find(r => r.path === checked.path);
            if (taken) {
                this.#log.warn(
                    `Extension "${instance}": public path "${checked.path}" is already answered by "${taken.instance}" - ignored`,
                );
                continue;
            }
            this.#routes.push({ instance, path: checked.path, handler: route.handler });
            this.#log.info(
                `Extension "${instance}" answers "${checked.path}" itself, without the authentication of web`,
            );
        }
        // The most specific path first, so that "/aura/mcp" wins over "/aura"
        this.#routes.sort((a, b) => b.path.length - a.path.length);
    }

    /**
     * Drop the paths of one extension, when it is stopped
     *
     * @param instance the extension instance, e.g. `aura.0`
     */
    remove(instance: string): void {
        for (let i = this.#routes.length - 1; i >= 0; i--) {
            if (this.#routes[i].instance === instance) {
                this.#routes.splice(i, 1);
            }
        }
    }

    /**
     * The route a request path belongs to
     *
     * @param pathname the path of the request, without the query
     */
    find(pathname: string): (PublicRoute & { instance: string }) | undefined {
        return this.#routes.find(r => pathname === r.path || pathname.startsWith(`${r.path}/`));
    }

    /** The middleware that hands these paths to their extension. Belongs in front of every authentication step */
    middleware(): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
            const route = this.#routes.length ? this.find(req.path) : undefined;
            if (!route) {
                next();
                return;
            }
            const fail = (err: unknown): void => {
                this.#log.warn(
                    `Extension "${route.instance}" failed to answer "${req.path}": ${err instanceof Error ? err.message : String(err)}`,
                );
                if (!res.headersSent) {
                    res.status(500).send('Internal Server Error');
                } else {
                    res.end();
                }
            };
            try {
                const result = route.handler(req, res, next);
                if (result instanceof Promise) {
                    result.catch(fail);
                }
            } catch (err) {
                fail(err);
            }
        };
    }
}
