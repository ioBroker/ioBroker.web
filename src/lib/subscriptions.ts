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

/** Options of a subscription, e.g. the user whose rights are checked */
type Options = Record<string, unknown> | null | undefined;
type Callback = (err?: Error | null) => void;
type AnyFunction = (...args: any[]) => any;

/** One pattern of one kind: a state or object id, or the files of an adapter */
export interface SubscriptionTarget {
    type: 'state' | 'object' | 'file';
    /** The pattern of states or objects, or the adapter id of files, e.g. `vis-2.0` */
    id: string;
    /** Only for files: the pattern of the file names */
    file?: string;
}

/** What subscribes the database: the methods of the adapter as js-controller made them */
export interface SubscriptionBackend {
    subscribe(target: SubscriptionTarget, options: Options): Promise<void>;
    unsubscribe(target: SubscriptionTarget, options: Options): Promise<void>;
}

/** Who subscribes: web, its socket server or one running extension */
export class SubscriptionCaller {
    /** What it holds, by key */
    readonly targets = new Map<string, SubscriptionTarget>();
    /** Set when it was released: from then on, what it asks for is ignored */
    closed = false;
    /** For the log, e.g. `cameras.0` */
    readonly name: string;

    /** @param name for the log, e.g. `cameras.0` */
    constructor(name: string) {
        this.name = name;
    }
}

function keyOf(target: SubscriptionTarget): string {
    return target.type === 'file' ? `file:${target.id}####${target.file}` : `${target.type}:${target.id}`;
}

/**
 * Who holds which subscription, and the database subscribed accordingly.
 *
 * Everything that happens to one pattern happens one after the other. js-controller reads a state before
 * it really unsubscribes, so a subscription that came right after the last unsubscription would otherwise
 * end up unsubscribed.
 */
export class SharedSubscriptions {
    readonly #backend: SubscriptionBackend;
    readonly #onError: (message: string) => void;
    /** Who holds a pattern, by key. A key is here as long as the database is subscribed to it */
    readonly #holders = new Map<string, Set<SubscriptionCaller>>();
    /** The last step of every pattern something is happening to, by key */
    readonly #queues = new Map<string, Promise<void>>();

    /**
     * @param backend what subscribes the database
     * @param onError where errors go that nobody waits for - those of {@link release}
     */
    constructor(backend: SubscriptionBackend, onError: (message: string) => void) {
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
    async subscribe(caller: SubscriptionCaller, targets: SubscriptionTarget[], options?: Options): Promise<void> {
        if (caller.closed) {
            return;
        }
        await Promise.all(
            targets.map(target =>
                this.#enqueue(keyOf(target), async key => {
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
                }),
            ),
        );
    }

    /**
     * Unsubscribe for a caller. The database is unsubscribed when nobody else holds the pattern - and
     * for a pattern that was not subscribed here, as before.
     *
     * @param caller who unsubscribes
     * @param targets what it unsubscribes
     * @param options the options of the call, e.g. the user
     */
    async unsubscribe(caller: SubscriptionCaller, targets: SubscriptionTarget[], options?: Options): Promise<void> {
        if (caller.closed) {
            return;
        }
        await Promise.all(
            targets.map(target =>
                this.#enqueue(keyOf(target), async key => {
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
                }),
            ),
        );
    }

    /**
     * Give up everything a caller still holds. What it asks for afterwards is ignored - a stopped
     * extension may still have requests running.
     *
     * @param caller who is gone, e.g. a stopped extension
     * @returns how many subscriptions it held
     */
    async release(caller: SubscriptionCaller): Promise<number> {
        caller.closed = true;
        const targets = [...caller.targets.values()];
        await Promise.all(
            targets.map(target =>
                this.#enqueue(keyOf(target), async key => {
                    const holders = this.#holders.get(key);
                    if (!holders?.delete(caller)) {
                        return;
                    }
                    caller.targets.delete(key);
                    if (!holders.size) {
                        this.#holders.delete(key);
                        await this.#backend.unsubscribe(target, undefined);
                    }
                }).catch(err => this.#onError(`Cannot unsubscribe "${keyOf(target)}" of "${caller.name}": ${err}`)),
            ),
        );
        return targets.length;
    }

    /**
     * Who holds a pattern
     *
     * @param target the pattern
     * @returns the names of the callers, in the order they subscribed
     */
    holders(target: SubscriptionTarget): string[] {
        return [...(this.#holders.get(keyOf(target)) || [])].map(caller => caller.name);
    }

    #enqueue(key: string, task: (key: string) => Promise<void>): Promise<void> {
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
] as const;

type MethodName = (typeof METHODS)[number];
type Methods = Record<MethodName, AnyFunction>;

/**
 * The patterns of a call, or null when it is not one this module understands - the adapter then gets
 * the call as it is and answers it as before, with its error for wrong arguments
 *
 * @param pattern a pattern or a list of them
 */
function patternsOf(pattern: unknown): string[] | null {
    if (typeof pattern === 'string') {
        return pattern ? [pattern] : null;
    }
    if (Array.isArray(pattern) && pattern.length && pattern.every(p => typeof p === 'string' && p)) {
        return [...new Set(pattern as string[])];
    }
    return null;
}

function isOptions(options: unknown): options is Options {
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
function methodsFor(
    namespace: () => string,
    original: Methods,
    shared: SharedSubscriptions,
    caller: SubscriptionCaller,
): Methods {
    // As the adapter does it: `*` is everything of this instance, an array is taken as it is
    const own = (pattern: string): string => {
        const ns = namespace();
        return pattern === '*'
            ? `${ns}.*`
            : pattern === ns || pattern.startsWith(`${ns}.`)
              ? pattern
              : `${ns}.${pattern}`;
    };
    const ownPatterns = (pattern: unknown): string[] | null =>
        typeof pattern === 'string' ? (pattern ? [own(pattern)] : null) : patternsOf(pattern);

    const withCallback =
        (
            name: MethodName,
            type: 'state' | 'object',
            unsubscribe: boolean,
            patterns: (pattern: unknown) => string[] | null,
            defaultPattern?: string,
        ) =>
        (pattern: unknown, options?: unknown, callback?: unknown): void => {
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
            const cb = callback as Callback | undefined;
            void (
                unsubscribe ? shared.unsubscribe(caller, targets, options) : shared.subscribe(caller, targets, options)
            )
                // As js-controller does it: without a callback, nobody hears of an error
                .then(
                    () => cb?.(),
                    err => cb?.(err),
                );
        };

    const promised =
        (
            name: MethodName,
            type: 'state' | 'object',
            unsubscribe: boolean,
            patterns: (pattern: unknown) => string[] | null,
            defaultPattern?: string,
        ) =>
        (pattern: unknown, options?: unknown): Promise<void> => {
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

    const files =
        (name: MethodName, unsubscribe: boolean) =>
        (id: unknown, pattern?: unknown, options?: unknown): Promise<void> => {
            const names = patternsOf(unsubscribe && !pattern ? '*' : pattern);
            if (typeof id !== 'string' || !id || !names || !isOptions(options)) {
                return original[name](id, pattern, options);
            }
            const targets = names.map(file => ({ type: 'file' as const, id, file }));
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

/** The adapter for one caller, and how to give up what it holds */
export interface CallerAdapter<T> {
    /** The adapter for this caller: subscriptions go through {@link SharedSubscriptions} under its name */
    adapter: T;
    caller: SubscriptionCaller;
    /**
     * Give up everything the caller still holds
     *
     * @returns how many subscriptions it held
     */
    release(): Promise<number>;
}

/** The shared subscriptions of an adapter */
export interface AdapterSubscriptions<T> {
    shared: SharedSubscriptions;
    /**
     * An adapter for one caller - an extension or the socket server. It is the adapter in everything but
     * its subscriptions.
     *
     * @param name the name of the caller, e.g. `cameras.0`
     */
    adapterFor(name: string): CallerAdapter<T>;
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
export function shareSubscriptions<T extends object>(
    adapter: T,
    onError: (message: string) => void,
): AdapterSubscriptions<T> {
    const target = adapter as T & Methods & { namespace: string };
    // Taken before they are replaced. The `…Async` methods of js-controller are fields of the object that
    // call the methods as they were when the adapter was constructed.
    const original = Object.fromEntries(
        METHODS.map(name => {
            const method = target[name];
            if (typeof method !== 'function') {
                throw new Error(`The adapter has no method "${name}"`);
            }
            return [name, method.bind(adapter)];
        }),
    ) as Methods;

    const backend: SubscriptionBackend = {
        subscribe: (t, options) =>
            t.type === 'state'
                ? original.subscribeForeignStatesAsync(t.id, options ?? undefined)
                : t.type === 'object'
                  ? original.subscribeForeignObjectsAsync(t.id, options ?? undefined)
                  : Promise.resolve().then(() => original.subscribeForeignFiles(t.id, t.file, options ?? undefined)),
        unsubscribe: (t, options) =>
            t.type === 'state'
                ? original.unsubscribeForeignStatesAsync(t.id, options ?? undefined)
                : t.type === 'object'
                  ? original.unsubscribeForeignObjectsAsync(t.id, options ?? undefined)
                  : Promise.resolve().then(() => original.unsubscribeForeignFiles(t.id, t.file, options ?? undefined)),
    };
    const shared = new SharedSubscriptions(backend, onError);
    const methods = (caller: SubscriptionCaller): Methods =>
        methodsFor(() => target.namespace, original, shared, caller);

    Object.assign(adapter, methods(new SubscriptionCaller('web')));

    return {
        shared,
        adapterFor(name: string): CallerAdapter<T> {
            const caller = new SubscriptionCaller(name);
            const own = methods(caller) as Record<string | symbol, AnyFunction>;
            const bound = new WeakMap<AnyFunction, AnyFunction>();
            const proxy = new Proxy(adapter, {
                get(obj, prop): unknown {
                    if (Object.hasOwn(own, prop)) {
                        return own[prop];
                    }
                    const value: unknown = Reflect.get(obj, prop, obj);
                    if (typeof value !== 'function' || prop === 'constructor') {
                        return value;
                    }
                    // The same function every time, so that it can be compared and removed again
                    let fn = bound.get(value as AnyFunction);
                    if (!fn) {
                        fn = (value as AnyFunction).bind(obj);
                        bound.set(value as AnyFunction, fn);
                    }
                    return fn;
                },
                set(obj, prop, value): boolean {
                    return Reflect.set(obj, prop, value, obj);
                },
            });
            return { adapter: proxy, caller, release: () => shared.release(caller) };
        },
    };
}
