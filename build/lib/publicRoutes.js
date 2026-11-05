"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicRoutes = void 0;
exports.checkPublicPath = checkPublicPath;
/** A plain path segment: no `.` or `..`, nothing encoded, no query */
const SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;
/**
 * The path as it is matched, or why it is refused
 *
 * @param path the path the extension named
 * @param adapterName the name of the extension's adapter, e.g. `aura`
 */
function checkPublicPath(path, adapterName) {
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
class PublicRoutes {
    #routes = [];
    #log;
    /** @param log where accepted and refused paths are reported */
    constructor(log) {
        this.#log = log;
    }
    /**
     * Take the paths one extension names. Each accepted one is logged: it is a path without the login of web.
     *
     * @param instance the extension instance, e.g. `aura.0`
     * @param routes what its `publicRoutes()` returned
     */
    add(instance, routes) {
        if (routes === undefined || routes === null) {
            return;
        }
        if (!Array.isArray(routes)) {
            this.#log.warn(`Extension "${instance}": publicRoutes() did not return an array - ignored`);
            return;
        }
        const adapterName = instance.split('.')[0];
        for (const route of routes) {
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
                this.#log.warn(`Extension "${instance}": public path "${checked.path}" is already answered by "${taken.instance}" - ignored`);
                continue;
            }
            this.#routes.push({ instance, path: checked.path, handler: route.handler });
            this.#log.info(`Extension "${instance}" answers "${checked.path}" itself, without the authentication of web`);
        }
        // The most specific path first, so that "/aura/mcp" wins over "/aura"
        this.#routes.sort((a, b) => b.path.length - a.path.length);
    }
    /**
     * Drop the paths of one extension, when it is stopped
     *
     * @param instance the extension instance, e.g. `aura.0`
     */
    remove(instance) {
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
    find(pathname) {
        return this.#routes.find(r => pathname === r.path || pathname.startsWith(`${r.path}/`));
    }
    /** The middleware that hands these paths to their extension. Belongs in front of every authentication step */
    middleware() {
        return (req, res, next) => {
            const route = this.#routes.length ? this.find(req.path) : undefined;
            if (!route) {
                next();
                return;
            }
            const fail = (err) => {
                this.#log.warn(`Extension "${route.instance}" failed to answer "${req.path}": ${err instanceof Error ? err.message : String(err)}`);
                if (!res.headersSent) {
                    res.status(500).send('Internal Server Error');
                }
                else {
                    res.end();
                }
            };
            try {
                const result = route.handler(req, res, next);
                if (result instanceof Promise) {
                    result.catch(fail);
                }
            }
            catch (err) {
                fail(err);
            }
        };
    }
}
exports.PublicRoutes = PublicRoutes;
//# sourceMappingURL=publicRoutes.js.map