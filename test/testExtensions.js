const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const express = require('express');
const {
    ExtensionRouters,
    createExtensionApp,
    createExtensionRouter,
    snapshotListeners,
    addedListeners,
    removeListeners,
    supportsHotReload,
    decideExtensionChange,
    extensionObjectChanged,
} = require('../build/lib/extensions');
const { PublicRoutes } = require('../build/lib/publicRoutes');

/**
 * Starts a server built like web: its own route, then the routers of the extensions, then a catch-all
 * that answers everything else - like the files from the object DB - and an error handler.
 *
 * @param routers the routers of the extensions
 */
function startServer(routers) {
    const app = express();
    app.get('/web', (_req, res) => res.send('web'));
    app.use(routers.middleware());
    app.use((req, res) => res.status(404).send(`catch-all ${req.path}`));
    // eslint-disable-next-line no-unused-vars
    app.use((err, _req, res, _next) => res.status(500).send(`error ${err.message}`));
    return new Promise(resolve => {
        const server = app.listen(0, '127.0.0.1', () => resolve({ app, server }));
    });
}

async function request(server, path, options) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
    return { status: res.status, body: await res.text() };
}

/**
 * Starts an extension the way web does: with a router of its own and an app that routes into it
 *
 * @param app the app of the server
 * @param routers the routers of the extensions
 * @param instance the instance name
 * @param install registers the routes
 */
function startExtension(app, routers, instance, install) {
    const router = createExtensionRouter(app);
    const extApp = createExtensionApp(app, router);
    install(extApp);
    routers.set(instance, router);
    return { router, extApp };
}

describe('Web extensions without restart', function () {
    describe('routers of the extensions', function () {
        let routers;
        let app;
        let server;

        beforeEach(async function () {
            routers = new ExtensionRouters();
            ({ app, server } = await startServer(routers));
        });

        afterEach(function () {
            server.close();
        });

        it('answers the routes of an extension that was started after the server', async function () {
            startExtension(app, routers, 'demo.0', extApp => {
                extApp.get('/demo/hello', (_req, res) => res.send('hello'));
                extApp.use('/demo/any', (req, res) => res.send(`any ${req.baseUrl} ${req.url}`));
            });
            assert.deepStrictEqual(await request(server, '/demo/hello'), { status: 200, body: 'hello' });
            assert.deepStrictEqual(await request(server, '/demo/any/x?y=1'), {
                status: 200,
                body: 'any /demo/any /x?y=1',
            });
            assert.deepStrictEqual(await request(server, '/web'), { status: 200, body: 'web' });
        });

        it('takes all routes of a stopped extension back', async function () {
            startExtension(app, routers, 'demo.0', extApp => {
                extApp.get('/demo/hello', (_req, res) => res.send('hello'));
                extApp.use((req, res, next) => (req.path === '/global' ? res.send('global') : next()));
            });
            assert.strictEqual((await request(server, '/global')).body, 'global');

            assert.strictEqual(routers.remove('demo.0'), true);
            assert.deepStrictEqual(await request(server, '/demo/hello'), {
                status: 404,
                body: 'catch-all /demo/hello',
            });
            assert.strictEqual((await request(server, '/global')).body, 'catch-all /global');
            assert.strictEqual(routers.remove('demo.0'), false);
        });

        it('replaces the router of an instance that is started again', async function () {
            startExtension(app, routers, 'demo.0', extApp => extApp.get('/demo', (_req, res) => res.send('old')));
            startExtension(app, routers, 'demo.0', extApp => extApp.get('/demo', (_req, res) => res.send('new')));
            assert.deepStrictEqual(routers.instances, ['demo.0']);
            assert.strictEqual((await request(server, '/demo')).body, 'new');
        });

        it('hands a request on from one extension to the next, in the order they were started', async function () {
            const seen = [];
            startExtension(app, routers, 'a.0', extApp =>
                extApp.use((_req, _res, next) => {
                    seen.push('a');
                    next();
                }),
            );
            startExtension(app, routers, 'b.0', extApp =>
                extApp.get('/b', (_req, res) => {
                    seen.push('b');
                    res.send('b');
                }),
            );
            assert.strictEqual((await request(server, '/b')).body, 'b');
            assert.deepStrictEqual(seen, ['a', 'b']);
        });

        it('leaves an extension with next("router") and goes on with the next one', async function () {
            startExtension(app, routers, 'a.0', extApp => extApp.use((_req, _res, next) => next('router')));
            startExtension(app, routers, 'b.0', extApp => extApp.get('/b', (_req, res) => res.send('b')));
            assert.strictEqual((await request(server, '/b')).body, 'b');
        });

        it('gives an error of an extension to the error handling of web', async function () {
            startExtension(app, routers, 'a.0', extApp =>
                extApp.get('/fail', () => {
                    throw new Error('broken');
                }),
            );
            assert.deepStrictEqual(await request(server, '/fail'), { status: 500, body: 'error broken' });
        });

        it('mounts a sub-app as Express does', async function () {
            const sub = express();
            let mountedOn;
            sub.on('mount', parent => (mountedOn = parent));
            sub.get('/hello', (req, res) => res.send(`sub ${req.baseUrl} ${req.app === sub}`));
            sub.use((_req, _res, next) => next());

            const seenApp = [];
            startExtension(app, routers, 'a.0', extApp => {
                extApp.use('/sub', sub);
                extApp.use((req, res) => {
                    seenApp.push(req.app === app);
                    res.send('after sub');
                });
            });
            assert.strictEqual(sub.mountpath, '/sub');
            assert.ok(mountedOn, 'mount event');
            assert.strictEqual((await request(server, '/sub/hello')).body, 'sub /sub true');
            // A request the sub-app does not answer comes back with the app of web
            assert.strictEqual((await request(server, '/sub/other')).body, 'after sub');
            assert.deepStrictEqual(seenApp, [true]);
        });

        it('supports route() and param()', async function () {
            startExtension(app, routers, 'a.0', extApp => {
                extApp.param('id', (req, _res, next, id) => {
                    req.upper = id.toUpperCase();
                    next();
                });
                extApp.route('/item/:id').get((req, res) => res.send(`get ${req.upper}`));
                extApp.all('/all', (req, res) => res.send(`all ${req.method}`));
            });
            assert.strictEqual((await request(server, '/item/abc')).body, 'get ABC');
            assert.strictEqual((await request(server, '/all', { method: 'POST' })).body, 'all POST');
        });

        it('lets an extension take its own routes out of _router.stack', async function () {
            const { extApp } = startExtension(app, routers, 'a.0', extApp => {
                extApp.get('/a', (_req, res) => res.send('a'));
                extApp.get('/b', (_req, res) => res.send('b'));
            });
            const index = extApp._router.stack.findIndex(layer => layer.route?.path === '/a');
            assert.notStrictEqual(index, -1);
            extApp._router.stack.splice(index, 1);
            assert.strictEqual((await request(server, '/a')).status, 404);
            assert.strictEqual((await request(server, '/b')).body, 'b');
        });
    });

    describe('the app of an extension', function () {
        it('is the app of web in everything but its router', function () {
            const app = express();
            const router = createExtensionRouter(app);
            const extApp = createExtensionApp(app, router);
            const layers = app.router.stack.length;

            assert.strictEqual(extApp.use((_req, _res, next) => next()), extApp, 'use() can be chained');
            assert.strictEqual(
                extApp.get('/x', (_req, res) => res.end()),
                extApp,
                'get() can be chained',
            );
            assert.strictEqual(app.router.stack.length, layers, 'nothing lands in the router of web');
            assert.strictEqual(router.stack.length, 2);
            assert.strictEqual(extApp.router, router);
            assert.strictEqual(extApp._router, router);

            app.set('demo setting', 'web');
            assert.strictEqual(extApp.get('demo setting'), 'web', 'get(setting) reads the settings of web');
            extApp.set('other setting', 1);
            assert.strictEqual(app.get('other setting'), 1, 'set() writes the settings of web');
            extApp.locals.shared = true;
            assert.strictEqual(app.locals.shared, true);
            assert.strictEqual(extApp.enabled('x-powered-by'), app.enabled('x-powered-by'));
        });

        it('routes as strictly as the app of web', function () {
            const app = express();
            app.enable('strict routing');
            app.enable('case sensitive routing');
            const router = createExtensionRouter(app);
            assert.strictEqual(router.strict, true);
            assert.strictEqual(router.caseSensitive, true);
        });
    });

    describe('listeners', function () {
        it('finds and removes what was added since a snapshot', function () {
            const emitter = new EventEmitter();
            const own = () => {};
            emitter.on('upgrade', own);
            const before = snapshotListeners(emitter);

            const added = () => {};
            const once = () => {};
            emitter.on('upgrade', added);
            emitter.once('message', once);

            const found = addedListeners(emitter, before);
            assert.deepStrictEqual([...found.keys()].sort(), ['message', 'upgrade']);
            assert.deepStrictEqual(found.get('upgrade'), [added]);

            assert.deepStrictEqual(removeListeners(emitter, found).sort(), ['message', 'upgrade']);
            assert.deepStrictEqual(emitter.listeners('upgrade'), [own]);
            assert.strictEqual(emitter.listenerCount('message'), 0);
        });

        it('leaves listeners alone that the extension removed itself', function () {
            const emitter = new EventEmitter();
            const before = snapshotListeners(emitter);
            const added = () => {};
            emitter.on('upgrade', added);
            const found = addedListeners(emitter, before);
            emitter.removeListener('upgrade', added);
            assert.deepStrictEqual(removeListeners(emitter, found), []);
        });
    });

    describe('supportsHotReload', function () {
        it('is read from the object or its class', function () {
            assert.strictEqual(supportsHotReload({ supportsHotReload: true }), true);
            class Static {
                static supportsHotReload = true;
            }
            assert.strictEqual(supportsHotReload(new Static()), true);
            class Field {
                supportsHotReload = true;
            }
            assert.strictEqual(supportsHotReload(new Field()), true);
        });

        it('is off unless it is exactly true', function () {
            assert.strictEqual(supportsHotReload({}), false);
            assert.strictEqual(supportsHotReload({ supportsHotReload: 'yes' }), false);
            assert.strictEqual(supportsHotReload(undefined), false);
            assert.strictEqual(supportsHotReload(null), false);
        });
    });

    describe('decideExtensionChange', function () {
        const obj = (changes = {}) => ({
            _id: 'system.adapter.demo.0',
            type: 'instance',
            common: { name: 'demo', version: '1.0.0', enabled: true, webExtension: 'lib/web.js', ...changes.common },
            native: { webInstance: '*', port: 1, ...changes.native },
            ts: changes.ts || 1,
            from: changes.from || 'system.adapter.admin.0',
        });
        const decide = options => decideExtensionChange({ instance: 'demo.0', ...options });

        it('ignores an extension that does not belong to this instance', function () {
            assert.deepStrictEqual(decide({ next: obj(), shouldRun: false }), { action: 'ignore' });
            assert.deepStrictEqual(decide({ next: null, shouldRun: false }), { action: 'ignore' });
        });

        it('starts an extension that now belongs to this instance', function () {
            assert.deepStrictEqual(decide({ next: obj(), shouldRun: true }), { action: 'load' });
        });

        it('starts it with the class already loaded, if the code is the same', function () {
            const next = obj();
            const loadedCode = require('../build/lib/extensions').extensionCode(next);
            assert.deepStrictEqual(decide({ next, shouldRun: true, loadedCode }), { action: 'load' });
        });

        it('restarts web for a new version of code this process loaded before', function () {
            const loadedCode = require('../build/lib/extensions').extensionCode(obj());
            const next = obj({ common: { version: '1.0.1' } });
            assert.strictEqual(decide({ next, shouldRun: true, loadedCode }).action, 'restart');
        });

        it('ignores a write that changed nothing the extension sees', function () {
            const running = { obj: obj(), hotReload: false };
            const next = obj({ ts: 2, from: 'system.host.x' });
            assert.deepStrictEqual(decide({ running, next, shouldRun: true }), { action: 'ignore' });
        });

        it('reloads an extension that supports it when its settings change', function () {
            const running = { obj: obj(), hotReload: true };
            assert.strictEqual(
                decide({ running, next: obj({ native: { port: 2 } }), shouldRun: true }).action,
                'reload',
            );
            assert.strictEqual(
                decide({ running, next: obj({ common: { title: 'other' } }), shouldRun: true }).action,
                'reload',
            );
        });

        it('restarts web for an extension that does not support it', function () {
            const running = { obj: obj(), hotReload: false };
            assert.strictEqual(
                decide({ running, next: obj({ native: { port: 2 } }), shouldRun: true }).action,
                'restart',
            );
        });

        it('restarts web for a new version, even if the extension supports reloading', function () {
            const running = { obj: obj(), hotReload: true };
            for (const common of [
                { version: '2.0.0' },
                { installedVersion: '2.0.0' },
                { installedFrom: 'iobroker/ioBroker.demo' },
                { webExtension: 'lib/other.js' },
            ]) {
                assert.strictEqual(
                    decide({ running, next: obj({ common }), shouldRun: true }).action,
                    'restart',
                    JSON.stringify(common),
                );
            }
        });

        it('stops an extension that no longer belongs to this instance', function () {
            const running = { obj: obj(), hotReload: true };
            const disabled = obj({ common: { enabled: false } });
            assert.strictEqual(decide({ running, next: disabled, shouldRun: false }).action, 'unload');
            assert.strictEqual(decide({ running, next: null, shouldRun: false }).action, 'unload');
            assert.strictEqual(
                decide({ running: { ...running, hotReload: false }, next: null, shouldRun: false }).action,
                'restart',
            );
        });

        it('compares common, native and the lists of protected attributes', function () {
            assert.strictEqual(extensionObjectChanged(obj(), obj({ ts: 5 })), false);
            assert.strictEqual(extensionObjectChanged(obj(), { ...obj(), encryptedNative: ['port'] }), true);
            assert.strictEqual(extensionObjectChanged(obj(), { ...obj(), protectedNative: ['port'] }), true);
        });
    });

    describe('PublicRoutes.remove', function () {
        it('drops the paths of one extension only', function () {
            const routes = new PublicRoutes({ info: () => {}, warn: () => {} });
            const handler = (_req, res) => res.end();
            routes.add('aura.0', [{ path: '/aura/mcp', handler }]);
            routes.add('mcp.0', [{ path: '/mcp', handler }]);
            routes.remove('aura.0');
            assert.strictEqual(routes.find('/aura/mcp'), undefined);
            assert.strictEqual(routes.find('/mcp/x')?.instance, 'mcp.0');
        });
    });
});
