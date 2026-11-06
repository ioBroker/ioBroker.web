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
export declare class SubscriptionCaller {
    /** What it holds, by key */
    readonly targets: Map<string, SubscriptionTarget>;
    /** Set when it was released: from then on, what it asks for is ignored */
    closed: boolean;
    /** For the log, e.g. `cameras.0` */
    readonly name: string;
    /** @param name for the log, e.g. `cameras.0` */
    constructor(name: string);
}
/**
 * Who holds which subscription, and the database subscribed accordingly.
 *
 * Everything that happens to one pattern happens one after the other. js-controller reads a state before
 * it really unsubscribes, so a subscription that came right after the last unsubscription would otherwise
 * end up unsubscribed.
 */
export declare class SharedSubscriptions {
    #private;
    /**
     * @param backend what subscribes the database
     * @param onError where errors go that nobody waits for - those of {@link release}
     */
    constructor(backend: SubscriptionBackend, onError: (message: string) => void);
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
    subscribe(caller: SubscriptionCaller, targets: SubscriptionTarget[], options?: Options): Promise<void>;
    /**
     * Unsubscribe for a caller. The database is unsubscribed when nobody else holds the pattern - and
     * for a pattern that was not subscribed here, as before.
     *
     * @param caller who unsubscribes
     * @param targets what it unsubscribes
     * @param options the options of the call, e.g. the user
     */
    unsubscribe(caller: SubscriptionCaller, targets: SubscriptionTarget[], options?: Options): Promise<void>;
    /**
     * Give up everything a caller still holds. What it asks for afterwards is ignored - a stopped
     * extension may still have requests running.
     *
     * @param caller who is gone, e.g. a stopped extension
     * @returns how many subscriptions it held
     */
    release(caller: SubscriptionCaller): Promise<number>;
    /**
     * Who holds a pattern
     *
     * @param target the pattern
     * @returns the names of the callers, in the order they subscribed
     */
    holders(target: SubscriptionTarget): string[];
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
export declare function shareSubscriptions<T extends object>(adapter: T, onError: (message: string) => void): AdapterSubscriptions<T>;
export {};
