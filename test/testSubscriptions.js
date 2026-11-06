const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { shareSubscriptions } = require('../build/lib/subscriptions');

/** As js-controller makes the `…Async` methods: fields of the object, bound to the methods as they were */
function promisify(fn, context) {
    return (...args) =>
        new Promise((resolve, reject) => fn.call(context, ...args, (err, res) => (err ? reject(err) : resolve(res))));
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * The database as the adapter sees it: one subscription per pattern, whoever asked for it, and the first
 * unsubscription ends it. Objects and files check the right to list objects.
 */
class FakeDb {
    constructor() {
        this.subscribed = { state: new Set(), object: new Set(), file: new Set() };
        /** Every call that reached the database: `subscribe state hm.0.a` */
        this.calls = [];
        /** Delay of an unsubscription, as js-controller reads a state before it unsubscribes */
        this.unsubscribeDelay = 0;
        this.subscribeDelay = 0;
    }

    async op(action, type, patterns, options) {
        if (type !== 'state' && options?.user === 'system.user.nobody') {
            throw new Error('permissionError');
        }
        for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
            this.calls.push(`${action} ${type} ${pattern}`);
            if (action === 'subscribe') {
                if (this.subscribeDelay) {
                    await wait(this.subscribeDelay);
                }
                this.subscribed[type].add(pattern);
            } else {
                if (this.unsubscribeDelay) {
                    await wait(this.unsubscribeDelay);
                }
                this.subscribed[type].delete(pattern);
            }
        }
    }

    has(type, pattern) {
        return this.subscribed[type].has(pattern);
    }
}

/** The part of the adapter of js-controller that is about subscriptions - with a private field like it */
class FakeAdapter extends EventEmitter {
    #db;

    constructor(db) {
        super();
        this.#db = db;
        this.namespace = 'web.0';
        for (const name of [
            'subscribeForeignStates',
            'unsubscribeForeignStates',
            'subscribeStates',
            'unsubscribeStates',
            'subscribeForeignObjects',
            'unsubscribeForeignObjects',
            'subscribeObjects',
            'unsubscribeObjects',
        ]) {
            this[`${name}Async`] = promisify(this[name], this);
        }
    }

    #call(action, type, pattern, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = undefined;
        }
        if (typeof pattern !== 'string' && !Array.isArray(pattern)) {
            throw new Error(`invalid pattern ${pattern}`);
        }
        this.#db.op(action, type, pattern, options).then(
            () => callback?.(),
            err => callback?.(err),
        );
    }

    #own(pattern) {
        return pattern === '*' ? 'web.0.*' : pattern.startsWith('web.0.') ? pattern : `web.0.${pattern}`;
    }

    subscribeForeignStates(pattern, options, callback) {
        this.#call('subscribe', 'state', pattern, options, callback);
    }
    unsubscribeForeignStates(pattern, options, callback) {
        this.#call('unsubscribe', 'state', pattern || '*', options, callback);
    }
    subscribeStates(pattern, options, callback) {
        this.#call('subscribe', 'state', this.#own(pattern), options, callback);
    }
    unsubscribeStates(pattern, options, callback) {
        this.#call('unsubscribe', 'state', this.#own(pattern), options, callback);
    }
    subscribeForeignObjects(pattern, options, callback) {
        this.#call('subscribe', 'object', pattern, options, callback);
    }
    unsubscribeForeignObjects(pattern, options, callback) {
        this.#call('unsubscribe', 'object', pattern || '*', options, callback);
    }
    subscribeObjects(pattern, options, callback) {
        this.#call('subscribe', 'object', this.#own(pattern), options, callback);
    }
    unsubscribeObjects(pattern, options, callback) {
        this.#call('unsubscribe', 'object', this.#own(pattern), options, callback);
    }
    subscribeForeignFiles(id, pattern, options) {
        if (typeof id !== 'string') {
            throw new Error('invalid id');
        }
        return this.#db.op('subscribe', 'file', `${id}####${pattern}`, options);
    }
    unsubscribeForeignFiles(id, pattern, options) {
        return this.#db.op('unsubscribe', 'file', `${id}####${pattern || '*'}`, options);
    }

    /** Reads a private field, as most methods of the adapter of js-controller do */
    dbName() {
        return this.#db.constructor.name;
    }
}

function setup() {
    const db = new FakeDb();
    const adapter = new FakeAdapter(db);
    const errors = [];
    const subscriptions = shareSubscriptions(adapter, message => errors.push(message));
    return { db, adapter, subscriptions, errors };
}

describe('Shared subscriptions', () => {
    it('keeps a state subscribed while another extension still needs it', async () => {
        const { db, subscriptions } = setup();
        const a = subscriptions.adapterFor('rest-api.0');
        const b = subscriptions.adapterFor('simple-api.0');

        await a.adapter.subscribeForeignStatesAsync('hm.0.a');
        await b.adapter.subscribeForeignStatesAsync('hm.0.a');
        assert.deepStrictEqual(db.calls, ['subscribe state hm.0.a'], 'the second one is only counted');

        await a.adapter.unsubscribeForeignStatesAsync('hm.0.a');
        assert.ok(db.has('state', 'hm.0.a'), 'still needed by simple-api');
        assert.deepStrictEqual(subscriptions.shared.holders({ type: 'state', id: 'hm.0.a' }), ['simple-api.0']);

        await b.adapter.unsubscribeForeignStatesAsync('hm.0.a');
        assert.ok(!db.has('state', 'hm.0.a'));
        assert.deepStrictEqual(db.calls, ['subscribe state hm.0.a', 'unsubscribe state hm.0.a']);
    });

    it('keeps one subscription per caller, as before: subscribing twice and giving it up once ends it', async () => {
        const { db, subscriptions } = setup();
        const a = subscriptions.adapterFor('simple-api.0');
        await a.adapter.subscribeForeignStatesAsync('hm.0.a');
        await a.adapter.subscribeForeignStatesAsync('hm.0.a');
        await a.adapter.unsubscribeForeignStatesAsync('hm.0.a');
        assert.ok(!db.has('state', 'hm.0.a'));
    });

    it('does not let an extension take a subscription of web or of the socket server away', async () => {
        const { db, adapter, subscriptions } = setup();
        const socket = subscriptions.adapterFor('socket');
        const ext = subscriptions.adapterFor('rest-api.0');

        await adapter.subscribeForeignObjectsAsync('system.adapter.*');
        await socket.adapter.subscribeForeignStatesAsync('hm.0.*');
        await ext.adapter.unsubscribeForeignObjectsAsync('system.adapter.*');
        await ext.adapter.unsubscribeForeignStatesAsync('hm.0.*');

        assert.ok(db.has('object', 'system.adapter.*'), 'web itself subscribes as "web"');
        assert.ok(db.has('state', 'hm.0.*'));
        assert.deepStrictEqual(subscriptions.shared.holders({ type: 'object', id: 'system.adapter.*' }), ['web']);
    });

    it('passes the unsubscription of a pattern nobody subscribed here on to the database, as before', async () => {
        const { db, subscriptions } = setup();
        db.subscribed.state.add('hm.0.b');
        await subscriptions.adapterFor('simple-api.0').adapter.unsubscribeForeignStatesAsync('hm.0.b');
        assert.ok(!db.has('state', 'hm.0.b'));
    });

    it('checks the rights again for every further subscriber of objects and files', async () => {
        const { db, subscriptions } = setup();
        const a = subscriptions.adapterFor('a.0');
        const b = subscriptions.adapterFor('b.0');

        await a.adapter.subscribeForeignObjectsAsync('hm.0.*', { user: 'system.user.admin' });
        await assert.rejects(
            b.adapter.subscribeForeignObjectsAsync('hm.0.*', { user: 'system.user.nobody' }),
            /permissionError/,
        );
        assert.deepStrictEqual(subscriptions.shared.holders({ type: 'object', id: 'hm.0.*' }), ['a.0']);

        await b.adapter.subscribeForeignObjectsAsync('hm.0.*', { user: 'system.user.admin' });
        assert.deepStrictEqual(db.calls, ['subscribe object hm.0.*', 'subscribe object hm.0.*']);
        assert.deepStrictEqual(subscriptions.shared.holders({ type: 'object', id: 'hm.0.*' }), ['a.0', 'b.0']);
    });

    it('does not count a failed first subscription', async () => {
        const { db, subscriptions } = setup();
        const a = subscriptions.adapterFor('a.0');
        await assert.rejects(a.adapter.subscribeForeignObjectsAsync('x.*', { user: 'system.user.nobody' }));
        assert.deepStrictEqual(subscriptions.shared.holders({ type: 'object', id: 'x.*' }), []);
        await a.adapter.unsubscribeForeignObjectsAsync('x.*');
        assert.deepStrictEqual(db.calls, ['unsubscribe object x.*'], 'not subscribed here: passed on');
    });

    it('gives up what a stopped extension still holds, but not what others hold too', async () => {
        const { db, subscriptions } = setup();
        const socket = subscriptions.adapterFor('socket');
        const ext = subscriptions.adapterFor('rest-api.0');

        await socket.adapter.subscribeForeignStatesAsync('hm.0.shared');
        await ext.adapter.subscribeForeignStatesAsync(['hm.0.shared', 'hm.0.own']);
        await ext.adapter.subscribeForeignObjectsAsync('hm.0.*');
        await ext.adapter.subscribeForeignFiles('vis-2.0', '*');

        assert.strictEqual(await ext.release(), 4);
        assert.ok(db.has('state', 'hm.0.shared'));
        assert.ok(!db.has('state', 'hm.0.own'));
        assert.ok(!db.has('object', 'hm.0.*'));
        assert.ok(!db.has('file', 'vis-2.0####*'));
        assert.deepStrictEqual(subscriptions.shared.holders({ type: 'state', id: 'hm.0.shared' }), ['socket']);
    });

    it('ignores what a stopped extension asks for afterwards', async () => {
        const { db, subscriptions } = setup();
        const ext = subscriptions.adapterFor('rest-api.0');
        await ext.release();
        await ext.adapter.subscribeForeignStatesAsync('hm.0.late');
        await new Promise(resolve => ext.adapter.subscribeForeignObjects('hm.0.late', resolve));
        assert.deepStrictEqual(db.calls, []);
    });

    it('takes a subscription back that was still running when the extension stopped', async () => {
        const { db, subscriptions } = setup();
        db.subscribeDelay = 30;
        const ext = subscriptions.adapterFor('rest-api.0');
        const running = ext.adapter.subscribeForeignStatesAsync('hm.0.slow');
        await wait(5);
        assert.deepStrictEqual(db.calls, ['subscribe state hm.0.slow'], 'the database is being asked');
        await ext.release();
        await running;
        assert.ok(!db.has('state', 'hm.0.slow'));
        assert.deepStrictEqual(db.calls, ['subscribe state hm.0.slow', 'unsubscribe state hm.0.slow']);
        assert.deepStrictEqual(subscriptions.shared.holders({ type: 'state', id: 'hm.0.slow' }), []);
    });

    it('does not ask the database for a subscription the extension gave up before it started', async () => {
        const { db, subscriptions } = setup();
        const ext = subscriptions.adapterFor('rest-api.0');
        const running = ext.adapter.subscribeForeignStatesAsync('hm.0.never');
        await ext.release();
        await running;
        assert.deepStrictEqual(db.calls, []);
    });

    it('does one thing after the other per pattern: a subscription right after the last unsubscription stays', async () => {
        const { db, subscriptions } = setup();
        db.unsubscribeDelay = 30;
        const a = subscriptions.adapterFor('a.0');
        const b = subscriptions.adapterFor('b.0');
        await a.adapter.subscribeForeignStatesAsync('hm.0.a');

        const gone = a.adapter.unsubscribeForeignStatesAsync('hm.0.a');
        const back = b.adapter.subscribeForeignStatesAsync('hm.0.a');
        await Promise.all([gone, back]);

        assert.ok(db.has('state', 'hm.0.a'));
        assert.deepStrictEqual(db.calls, ['subscribe state hm.0.a', 'unsubscribe state hm.0.a', 'subscribe state hm.0.a']);
    });

    it('takes the states and objects of the own namespace as the same patterns as the foreign ones', async () => {
        const { db, subscriptions } = setup();
        const a = subscriptions.adapterFor('a.0');
        const b = subscriptions.adapterFor('b.0');

        await a.adapter.subscribeStatesAsync('*');
        await b.adapter.subscribeForeignStatesAsync('web.0.*');
        await a.adapter.unsubscribeStatesAsync('*');
        assert.ok(db.has('state', 'web.0.*'));

        await a.adapter.subscribeObjectsAsync('info');
        await b.adapter.unsubscribeForeignObjectsAsync('web.0.info');
        assert.ok(db.has('object', 'web.0.info'));
        assert.deepStrictEqual(subscriptions.shared.holders({ type: 'object', id: 'web.0.info' }), ['a.0']);
    });

    it('works with callbacks, with and without options', async () => {
        const { db, subscriptions } = setup();
        const a = subscriptions.adapterFor('a.0');
        await new Promise((resolve, reject) =>
            a.adapter.subscribeForeignStates('hm.0.cb', err => (err ? reject(err) : resolve())),
        );
        await new Promise((resolve, reject) =>
            a.adapter.subscribeForeignObjects('hm.0.cb', { user: 'system.user.admin' }, err =>
                err ? reject(err) : resolve(),
            ),
        );
        const err = await new Promise(resolve =>
            a.adapter.subscribeForeignObjects('hm.0.no', { user: 'system.user.nobody' }, resolve),
        );
        assert.match(String(err), /permissionError/);
        await new Promise(resolve => a.adapter.unsubscribeForeignStates('hm.0.cb', resolve));
        assert.ok(!db.has('state', 'hm.0.cb'));
        assert.ok(db.has('object', 'hm.0.cb'));
    });

    it('defaults the pattern of an unsubscription to "*", as js-controller does', async () => {
        const { db, subscriptions } = setup();
        const a = subscriptions.adapterFor('a.0');
        const b = subscriptions.adapterFor('b.0');
        await a.adapter.subscribeForeignObjectsAsync('*');
        await b.adapter.subscribeForeignObjectsAsync('*');
        await a.adapter.unsubscribeForeignObjectsAsync();
        await a.adapter.unsubscribeForeignObjectsAsync('');
        assert.ok(db.has('object', '*'));
        assert.deepStrictEqual(subscriptions.shared.holders({ type: 'object', id: '*' }), ['b.0']);
        await b.adapter.unsubscribeForeignFiles('vis-2.0');
        assert.deepStrictEqual(db.calls.slice(-1), ['unsubscribe file vis-2.0####*']);
    });

    it('leaves calls it does not understand to the adapter, with its errors', () => {
        const { subscriptions } = setup();
        const a = subscriptions.adapterFor('a.0');
        assert.throws(() => a.adapter.subscribeForeignStates(42), /invalid pattern/);
        assert.throws(() => a.adapter.subscribeForeignFiles(undefined, '*'), /invalid id/);
        return assert.rejects(a.adapter.subscribeForeignStatesAsync(/regexp/), /invalid pattern/);
    });

    it('is the adapter in everything else', () => {
        const { adapter, subscriptions } = setup();
        const a = subscriptions.adapterFor('a.0');

        assert.strictEqual(a.adapter.dbName(), 'FakeDb', 'methods reading private fields work');
        assert.strictEqual(a.adapter.namespace, 'web.0');
        assert.ok(a.adapter instanceof FakeAdapter);
        assert.strictEqual(a.adapter.on, a.adapter.on, 'the same function every time');

        const listener = () => {};
        a.adapter.on('message', listener);
        assert.deepStrictEqual(adapter.listeners('message'), [listener]);
        a.adapter.removeListener('message', listener);
        assert.strictEqual(adapter.listenerCount('message'), 0);

        a.adapter.someFlag = true;
        assert.strictEqual(adapter.someFlag, true);
    });
});
