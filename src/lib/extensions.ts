import type { EventEmitter } from 'node:events';
import { isDeepStrictEqual } from 'node:util';
import express, { type Express, type NextFunction, type Request, type RequestHandler, type Response } from 'express';

/**
 * Web extensions that are started and stopped while web keeps running.
 *
 * Express cannot take a route back, so every extension gets a router of its own instead of the app of
 * web: {@link createExtensionApp} hands it an app whose routes end up in that router, and
 * {@link ExtensionRouters} answers requests with the routers of the extensions that run right now. To
 * stop an extension, its router is dropped - with everything it ever registered.
 */

/** The router of one extension */
export type ExtensionRouter = express.Router;

/**
 * A router that takes the routing settings of the app, as the router of the app itself does
 *
 * @param app the app of web
 */
export function createExtensionRouter(app: Express): ExtensionRouter {
    return express.Router({
        caseSensitive: app.enabled('case sensitive routing'),
        strict: app.enabled('strict routing'),
    });
}

/**
 * The app an extension gets instead of the app of web.
 *
 * It is the app of web in everything but its router: Express routes every `use()`, `get()`, `post()`,
 * `all()`, `route()` and `param()` through `this.router`, so they all land in the router of the
 * extension - with the exact behavior of Express, mounted sub-apps and `app.get(setting)` included.
 * Settings, `locals`, engines and events are those of web. `_router` is the router of the extension as
 * well, for extensions that take their routes out of its `stack` themselves.
 *
 * @param app the app of web
 * @param router the router of the extension
 */
export function createExtensionApp(app: Express, router: ExtensionRouter): Express {
    return new Proxy(app, {
        get(target, prop, receiver): unknown {
            if (prop === 'router' || prop === '_router') {
                return router;
            }
            // With the proxy as `this`, so that the methods of Express find the router above
            return Reflect.get(target, prop, receiver);
        },
    });
}

/**
 * The routers of the running extensions, in the order they were started.
 *
 * {@link middleware} takes the place in the chain of web where the extensions used to register their
 * routes directly: behind the routes of web, in front of the files from the object DB.
 */
export class ExtensionRouters {
    /** Replaced as a whole on every change, so a request keeps the list it started with */
    #routers: readonly { instance: string; router: ExtensionRouter }[] = [];

    /**
     * Start answering with the router of an extension. A previous router of the same instance is dropped.
     *
     * @param instance the extension instance, e.g. `cameras.0`
     * @param router its router
     */
    set(instance: string, router: ExtensionRouter): void {
        this.#routers = [...this.#routers.filter(r => r.instance !== instance), { instance, router }];
    }

    /**
     * Stop answering with the router of an extension
     *
     * @param instance the extension instance, e.g. `cameras.0`
     * @returns whether the instance had a router
     */
    remove(instance: string): boolean {
        const routers = this.#routers.filter(r => r.instance !== instance);
        const removed = routers.length !== this.#routers.length;
        this.#routers = routers;
        return removed;
    }

    /** The instances that answer requests right now */
    get instances(): string[] {
        return this.#routers.map(r => r.instance);
    }

    /**
     * Hands a request to the routers one after the other, as if their routes were registered in the app.
     * An error ends the walk and goes to the error handling of web: a router only takes a request, not
     * an error, so the error handlers of the following extensions cannot be reached.
     */
    middleware(): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
            const routers = this.#routers;
            let i = 0;
            const step = (err?: unknown): void => {
                if (err) {
                    next(err);
                    return;
                }
                const entry = routers[i++];
                if (!entry) {
                    next();
                    return;
                }
                entry.router(req, res, step);
            };
            step();
        };
    }
}

type Listener = (...args: any[]) => void;

/** The listeners of an emitter, by event */
export type Listeners = Map<string | symbol, Listener[]>;

/**
 * The listeners an emitter has right now
 *
 * @param emitter e.g. the server of web
 */
export function snapshotListeners(emitter: EventEmitter): Listeners {
    const snapshot: Listeners = new Map();
    for (const event of emitter.eventNames()) {
        snapshot.set(event, emitter.listeners(event) as Listener[]);
    }
    return snapshot;
}

/**
 * The listeners that were added since a snapshot
 *
 * @param emitter the emitter of the snapshot
 * @param before what {@link snapshotListeners} returned
 */
export function addedListeners(emitter: EventEmitter, before: Listeners): Listeners {
    const added: Listeners = new Map();
    for (const event of emitter.eventNames()) {
        const previous = before.get(event) || [];
        const fresh = (emitter.listeners(event) as Listener[]).filter(l => !previous.includes(l));
        if (fresh.length) {
            added.set(event, fresh);
        }
    }
    return added;
}

/**
 * Remove those of the given listeners the emitter still has
 *
 * @param emitter the emitter
 * @param listeners what {@link addedListeners} returned
 * @returns the events of the removed listeners, one entry per listener
 */
export function removeListeners(emitter: EventEmitter, listeners: Listeners): (string | symbol)[] {
    const removed: (string | symbol)[] = [];
    for (const [event, list] of listeners) {
        for (const listener of list) {
            if ((emitter.listeners(event) as Listener[]).includes(listener)) {
                emitter.removeListener(event, listener);
                removed.push(event);
            }
        }
    }
    return removed;
}

/**
 * Whether a running extension can be stopped without a restart of web: it says so itself, as a property of
 * the object or of its class, and so promises that its `unload()` gives back everything it took from web
 * besides its routes.
 *
 * @param ext the running extension
 */
export function supportsHotReload(ext: unknown): boolean {
    if (!ext || typeof ext !== 'object') {
        return false;
    }
    const obj = ext as { supportsHotReload?: unknown; constructor?: { supportsHotReload?: unknown } };
    return obj.supportsHotReload === true || obj.constructor?.supportsHotReload === true;
}

/**
 * What identifies the code of an extension: another version - or another installation of the same one -
 * means another code, which cannot be loaded into a running process. The cache of `require()` still holds
 * the old one.
 *
 * @param obj the instance object
 */
export function extensionCode(obj: ioBroker.InstanceObject): string {
    const common = obj.common as ioBroker.InstanceCommon & { installedVersion?: string; installedFrom?: string };
    return JSON.stringify([common.version, common.installedVersion, common.installedFrom, common.webExtension]);
}

/**
 * Whether two instance objects differ in what an extension sees. Who wrote it and when does not count.
 *
 * @param a one instance object
 * @param b the other one
 */
export function extensionObjectChanged(a: ioBroker.InstanceObject, b: ioBroker.InstanceObject): boolean {
    return (
        !isDeepStrictEqual(a.common, b.common) ||
        !isDeepStrictEqual(a.native, b.native) ||
        !isDeepStrictEqual(a.encryptedNative, b.encryptedNative) ||
        !isDeepStrictEqual(a.protectedNative, b.protectedNative)
    );
}

/** What to do about a changed instance object of an extension */
export type ExtensionChange =
    | { action: 'ignore' }
    | { action: 'load' }
    | { action: 'unload'; reason: string }
    | { action: 'reload'; reason: string }
    | { action: 'restart'; reason: string };

/**
 * What to do when the instance object of an extension changed
 *
 * @param options what is known about the instance
 * @param options.instance the extension instance, e.g. `cameras.0`
 * @param options.running the extension as it runs. Not set when it does not run
 * @param options.running.obj the instance object it was started with, as it was read (not decrypted)
 * @param options.running.hotReload whether it can be stopped without a restart of web
 * @param options.next the instance object now, null when it was deleted
 * @param options.shouldRun whether the extension belongs to this web instance now
 * @param options.loadedCode {@link extensionCode} of the code of this adapter that this process loaded before,
 *   if any
 */
export function decideExtensionChange(options: {
    instance: string;
    running?: { obj: ioBroker.InstanceObject; hotReload: boolean };
    next: ioBroker.InstanceObject | null;
    shouldRun: boolean;
    loadedCode?: string;
}): ExtensionChange {
    const { instance, running, next, shouldRun, loadedCode } = options;

    if (!running) {
        if (!shouldRun || !next) {
            return { action: 'ignore' };
        }
        if (loadedCode !== undefined && loadedCode !== extensionCode(next)) {
            return { action: 'restart', reason: `Restart to load the new version of web extension "${instance}"` };
        }
        return { action: 'load' };
    }

    if (!shouldRun || !next) {
        return running.hotReload
            ? { action: 'unload', reason: `web extension "${instance}" is no longer used by this instance` }
            : { action: 'restart', reason: `Restart to unload the web extension "${instance}"` };
    }

    if (!extensionObjectChanged(running.obj, next)) {
        return { action: 'ignore' };
    }

    if (extensionCode(running.obj) !== extensionCode(next)) {
        return { action: 'restart', reason: `Restart to load the new version of web extension "${instance}"` };
    }

    return running.hotReload
        ? { action: 'reload', reason: `settings of web extension "${instance}" changed` }
        : { action: 'restart', reason: `Restart to load the changed web extension "${instance}"` };
}
