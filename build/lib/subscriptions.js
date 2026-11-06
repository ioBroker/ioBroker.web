"use strict";
/**
 * Subscriptions that web, its socket server and the web extensions share.
 *
 * They all use the one adapter of web, and js-controller does not count who subscribed a pattern: two
 * subscriptions of the same pattern are one in the database, and the first `unsubscribe…()` ends it for
 * everybody. An extension that gave up a state took it away from the socket clients of web and from the
 * other extensions, which got no more changes of it.
 *
 * Here every subscription is noted with whoever asked for it (a {@link SubscriptionCaller}). The database
 * gets the first subscription of a pattern and the unsubscription of the last one - in between, the
 * others only change the count. A caller that subscribes a pattern twice holds it once, as before, so for
 * each of them alone nothing changes. And when an extension stops, everything it still holds is given up
 * for it ({@link SharedSubscriptions.release}).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedSubscriptions = exports.SubscriptionCaller = void 0;
exports.shareSubscriptions = shareSubscriptions;
/** Who subscribes: web, its socket server or one running extension */
class SubscriptionCaller {
    /** What it holds, by key */
    targets = new Map();
    /** Set when it was released: from then on, what it asks for is ignored */
    closed = false;
    /** For the log, e.g. `cameras.0` */
    name;
    /** @param name for the log, e.g. `cameras.0` */
    constructor(name) {
        this.name = name;
    }
}
exports.SubscriptionCaller = SubscriptionCaller;
function keyOf(target) {
    return target.type === 'file' ? `file:${target.id}####${target.file}` : `${target.type}:${target.id}`;
}
/**
 * Who holds which subscription, and the database subscribed accordingly.
 *
 * Everything that happens to one pattern happens one after the other. js-controller reads a state before
 * it really unsubscribes, so a subscription that came right after the last unsubscription would otherwise
 * end up unsubscribed.
 */
class SharedSubscriptions {
    #backend;
    #onError;
    /** Who holds a pattern, by key. A key is here as long as the database is subscribed to it */
    #holders = new Map();
    /** The last step of every pattern something is happening to, by key */
    #queues = new Map();
    /**
     * @param backend what subscribes the database
     * @param onError where errors go that nobody waits for - those of {@link release}
     */
    constructor(backend, onError) {
        this.#backend = backend;
        this.#onError = onError;
    }
    /**
     * Subscribe for a caller. The database is subscribed for the first caller of a pattern. Objects and
     * files are subscribed again for every further one: that checks the rights of the user in the
     * options, as before, and does nothing else - the database keeps one subscription per pattern. The
     * subscription of states checks no rights and counts the subscribers of some adapters
     * (`system.adapter.<instance>.subscribes`), so it is not repeated.
     *
     * @param caller who subscribes
     * @param targets what it subscribes
     * @param options the options of the call, e.g. the user
     */
    async subscribe(caller, targets, options) {
        if (caller.closed) {
            return;
        }
        await Promise.all(targets.map(target => this.#enqueue(keyOf(target), async (key) => {
            if (caller.closed) {
                return;
            }
            const holders = this.#holders.get(key);
            if (holders) {
                if (target.type !== 'state') {
                    await this.#backend.subscribe(target, options);
                }
                if (!caller.closed) {
                    holders.add(caller);
                    caller.targets.set(key, target);
                }
                return;
            }
            await this.#backend.subscribe(target, options);
            if (caller.closed) {
                // Released while the database was asked: nobody holds it
                await this.#backend.unsubscribe(target, options);
                return;
            }
            this.#holders.set(key, new Set([caller]));
            caller.targets.set(key, target);
        })));
    }
    /**
     * Unsubscribe for a caller. The database is unsubscribed when nobody else holds the pattern - and
     * for a pattern that was not subscribed here, as before.
     *
     * @param caller who unsubscribes
     * @param targets what it unsubscribes
     * @param options the options of the call, e.g. the user
     */
    async unsubscribe(caller, targets, options) {
        if (caller.closed) {
            return;
        }
        await Promise.all(targets.map(target => this.#enqueue(keyOf(target), async (key) => {
            const holders = this.#holders.get(key);
            if (!holders) {
                await this.#backend.unsubscribe(target, options);
                return;
            }
            if (holders.delete(caller)) {
                caller.targets.delete(key);
                if (!holders.size) {
                    this.#holders.delete(key);
                    await this.#backend.unsubscribe(target, options);
                }
            }
        })));
    }
    /**
     * Give up everything a caller still holds. What it asks for afterwards is ignored - a stopped
     * extension may still have requests running.
     *
     * @param caller who is gone, e.g. a stopped extension
     * @returns how many subscriptions it held
     */
    async release(caller) {
        caller.closed = true;
        const targets = [...caller.targets.values()];
        await Promise.all(targets.map(target => this.#enqueue(keyOf(target), async (key) => {
            const holders = this.#holders.get(key);
            if (!holders?.delete(caller)) {
                return;
            }
            caller.targets.delete(key);
            if (!holders.size) {
                this.#holders.delete(key);
                await this.#backend.unsubscribe(target, undefined);
            }
        }).catch(err => this.#onError(`Cannot unsubscribe "${keyOf(target)}" of "${caller.name}": ${err}`))));
        return targets.length;
    }
    /**
     * Who holds a pattern
     *
     * @param target the pattern
     * @returns the names of the callers, in the order they subscribed
     */
    holders(target) {
        return [...(this.#holders.get(keyOf(target)) || [])].map(caller => caller.name);
    }
    #enqueue(key, task) {
        const run = (this.#queues.get(key) || Promise.resolve()).then(() => task(key));
        const tail = run.catch(() => undefined);
        this.#queues.set(key, tail);
        void tail.then(() => {
            if (this.#queues.get(key) === tail) {
                this.#queues.delete(key);
            }
        });
        return run;
    }
}
exports.SharedSubscriptions = SharedSubscriptions;
/** The methods of the adapter that subscribe or unsubscribe */
const METHODS = [
    'subscribeForeignStates',
    'subscribeForeignStatesAsync',
    'unsubscribeForeignStates',
    'unsubscribeForeignStatesAsync',
    'subscribeStates',
    'subscribeStatesAsync',
    'unsubscribeStates',
    'unsubscribeStatesAsync',
    'subscribeForeignObjects',
    'subscribeForeignObjectsAsync',
    'unsubscribeForeignObjects',
    'unsubscribeForeignObjectsAsync',
    'subscribeObjects',
    'subscribeObjectsAsync',
    'unsubscribeObjects',
    'unsubscribeObjectsAsync',
    'subscribeForeignFiles',
    'unsubscribeForeignFiles',
];
/**
 * The patterns of a call, or null when it is not one this module understands - the adapter then gets
 * the call as it is and answers it as before, with its error for wrong arguments
 *
 * @param pattern a pattern or a list of them
 */
function patternsOf(pattern) {
    if (typeof pattern === 'string') {
        return pattern ? [pattern] : null;
    }
    if (Array.isArray(pattern) && pattern.length && pattern.every(p => typeof p === 'string' && p)) {
        return [...new Set(pattern)];
    }
    return null;
}
function isOptions(options) {
    return options === undefined || options === null || typeof options === 'object';
}
/**
 * The methods of the adapter for one caller
 *
 * @param namespace the namespace of the adapter, e.g. `web.0` - read on every call, js-controller may set it late
 * @param original the methods of the adapter as js-controller made them
 * @param shared the shared subscriptions
 * @param caller who calls
 */
function methodsFor(namespace, original, shared, caller) {
    // As the adapter does it: `*` is everything of this instance, an array is taken as it is
    const own = (pattern) => {
        const ns = namespace();
        return pattern === '*'
            ? `${ns}.*`
            : pattern === ns || pattern.startsWith(`${ns}.`)
                ? pattern
                : `${ns}.${pattern}`;
    };
    const ownPatterns = (pattern) => typeof pattern === 'string' ? (pattern ? [own(pattern)] : null) : patternsOf(pattern);
    const withCallback = (name, type, unsubscribe, patterns, defaultPattern) => (pattern, options, callback) => {
        if (typeof options === 'function') {
            callback = options;
            options = undefined;
        }
        // As js-controller does it: `pattern || '*'`
        const ids = patterns(defaultPattern !== undefined && !pattern ? defaultPattern : pattern);
        if (!ids || !isOptions(options) || (callback !== undefined && typeof callback !== 'function')) {
            return original[name](pattern, options, callback);
        }
        const targets = ids.map(id => ({ type, id }));
        const cb = callback;
        void (unsubscribe ? shared.unsubscribe(caller, targets, options) : shared.subscribe(caller, targets, options))
            // As js-controller does it: without a callback, nobody hears of an error
            .then(() => cb?.(), err => cb?.(err));
    };
    const promised = (name, type, unsubscribe, patterns, defaultPattern) => (pattern, options) => {
        // As js-controller does it: `pattern || '*'`
        const ids = patterns(defaultPattern !== undefined && !pattern ? defaultPattern : pattern);
        if (!ids || !isOptions(options)) {
            return original[name](pattern, options);
        }
        const targets = ids.map(id => ({ type, id }));
        return unsubscribe
            ? shared.unsubscribe(caller, targets, options)
            : shared.subscribe(caller, targets, options);
    };
    const files = (name, unsubscribe) => (id, pattern, options) => {
        const names = patternsOf(unsubscribe && !pattern ? '*' : pattern);
        if (typeof id !== 'string' || !id || !names || !isOptions(options)) {
            return original[name](id, pattern, options);
        }
        const targets = names.map(file => ({ type: 'file', id, file }));
        return unsubscribe
            ? shared.unsubscribe(caller, targets, options)
            : shared.subscribe(caller, targets, options);
    };
    return {
        subscribeForeignStates: withCallback('subscribeForeignStates', 'state', false, patternsOf),
        subscribeForeignStatesAsync: promised('subscribeForeignStatesAsync', 'state', false, patternsOf),
        unsubscribeForeignStates: withCallback('unsubscribeForeignStates', 'state', true, patternsOf, '*'),
        unsubscribeForeignStatesAsync: promised('unsubscribeForeignStatesAsync', 'state', true, patternsOf, '*'),
        subscribeStates: withCallback('subscribeStates', 'state', false, ownPatterns),
        subscribeStatesAsync: promised('subscribeStatesAsync', 'state', false, ownPatterns),
        unsubscribeStates: withCallback('unsubscribeStates', 'state', true, ownPatterns),
        unsubscribeStatesAsync: promised('unsubscribeStatesAsync', 'state', true, ownPatterns),
        subscribeForeignObjects: withCallback('subscribeForeignObjects', 'object', false, patternsOf),
        subscribeForeignObjectsAsync: promised('subscribeForeignObjectsAsync', 'object', false, patternsOf),
        unsubscribeForeignObjects: withCallback('unsubscribeForeignObjects', 'object', true, patternsOf, '*'),
        unsubscribeForeignObjectsAsync: promised('unsubscribeForeignObjectsAsync', 'object', true, patternsOf, '*'),
        subscribeObjects: withCallback('subscribeObjects', 'object', false, ownPatterns),
        subscribeObjectsAsync: promised('subscribeObjectsAsync', 'object', false, ownPatterns),
        unsubscribeObjects: withCallback('unsubscribeObjects', 'object', true, ownPatterns),
        unsubscribeObjectsAsync: promised('unsubscribeObjectsAsync', 'object', true, ownPatterns),
        subscribeForeignFiles: files('subscribeForeignFiles', false),
        unsubscribeForeignFiles: files('unsubscribeForeignFiles', true),
    };
}
/**
 * Let the callers of an adapter share its subscriptions.
 *
 * The adapter itself subscribes as the caller `web` from now on: its methods are replaced on the object.
 * Everybody else gets {@link AdapterSubscriptions.adapterFor} - a proxy of the adapter with methods of its
 * own for the subscriptions. All other methods are those of the adapter, bound to it: the adapter of
 * js-controller keeps fields that only the adapter itself can read (`#…`), so with the proxy as `this`
 * they would throw.
 *
 * @param adapter the adapter, right after it was constructed - before anything subscribed
 * @param onError where errors go that nobody waits for
 */
function shareSubscriptions(adapter, onError) {
    const target = adapter;
    // Taken before they are replaced. The `…Async` methods of js-controller are fields of the object that
    // call the methods as they were when the adapter was constructed.
    const original = Object.fromEntries(METHODS.map(name => {
        const method = target[name];
        if (typeof method !== 'function') {
            throw new Error(`The adapter has no method "${name}"`);
        }
        return [name, method.bind(adapter)];
    }));
    const backend = {
        subscribe: (t, options) => t.type === 'state'
            ? original.subscribeForeignStatesAsync(t.id, options ?? undefined)
            : t.type === 'object'
                ? original.subscribeForeignObjectsAsync(t.id, options ?? undefined)
                : Promise.resolve().then(() => original.subscribeForeignFiles(t.id, t.file, options ?? undefined)),
        unsubscribe: (t, options) => t.type === 'state'
            ? original.unsubscribeForeignStatesAsync(t.id, options ?? undefined)
            : t.type === 'object'
                ? original.unsubscribeForeignObjectsAsync(t.id, options ?? undefined)
                : Promise.resolve().then(() => original.unsubscribeForeignFiles(t.id, t.file, options ?? undefined)),
    };
    const shared = new SharedSubscriptions(backend, onError);
    const methods = (caller) => methodsFor(() => target.namespace, original, shared, caller);
    Object.assign(adapter, methods(new SubscriptionCaller('web')));
    return {
        shared,
        adapterFor(name) {
            const caller = new SubscriptionCaller(name);
            const own = methods(caller);
            const bound = new WeakMap();
            const proxy = new Proxy(adapter, {
                get(obj, prop) {
                    if (Object.hasOwn(own, prop)) {
                        return own[prop];
                    }
                    const value = Reflect.get(obj, prop, obj);
                    if (typeof value !== 'function' || prop === 'constructor') {
                        return value;
                    }
                    // The same function every time, so that it can be compared and removed again
                    let fn = bound.get(value);
                    if (!fn) {
                        fn = value.bind(obj);
                        bound.set(value, fn);
                    }
                    return fn;
                },
                set(obj, prop, value) {
                    return Reflect.set(obj, prop, value, obj);
                },
            });
            return { adapter: proxy, caller, release: () => shared.release(caller) };
        },
    };
}
//# sourceMappingURL=subscriptions.js.map