const assert = require('node:assert');
const express = require('express');
const { PublicRoutes, checkPublicPath } = require('../build/lib/publicRoutes');
const { bodyParsers } = require('../build/lib/utils');

/** Collects what the routes report, instead of the adapter log */
function logger() {
    const log = { info: [], warn: [] };
    return {
        log,
        info: message => log.info.push(message),
        warn: message => log.warn.push(message),
    };
}

/**
 * Starts a server built like web with authentication: the public paths in front, then the body parsers
 * and a login check that refuses everything - like the OAuth2 layer refuses a bearer token it did not issue.
 *
 * @param routes the public paths
 */
function startServer(routes) {
    const app = express();
    app.use(routes.middleware());
    bodyParsers().forEach(parser => app.use(parser));
    app.use((_req, res) => res.status(401).send('login required'));
    return new Promise(resolve => {
        const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
}

async function request(server, path, options) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
    return { status: res.status, body: await res.text() };
}

/** A handler that names itself and the path it got */
const answer = name => (req, res) => res.send(`${name} ${req.path}`);

describe('Public routes of web extensions', function () {
    describe('checkPublicPath', function () {
        it('takes a path below the adapter name', function () {
            assert.deepStrictEqual(checkPublicPath('/aura/mcp', 'aura'), { path: '/aura/mcp' });
        });

        it('takes the adapter name itself', function () {
            assert.deepStrictEqual(checkPublicPath('/aura', 'aura'), { path: '/aura' });
        });

        it('drops a trailing slash', function () {
            assert.deepStrictEqual(checkPublicPath('/aura/mcp/', 'aura'), { path: '/aura/mcp' });
        });

        for (const path of [
            '/',
            '',
            'aura/mcp',
            '/vis-2/mcp',
            '/auraX/mcp',
            '/login',
            '/.well-known/oauth-protected-resource',
            '/aura/../vis-2',
            '/aura/./mcp',
            '/aura//mcp',
            '/aura/%2e%2e/vis-2',
            '/aura/mcp?token=1',
            '/aura/.well-known',
            '/aura/mcp#x',
        ]) {
            it(`refuses ${JSON.stringify(path)}`, function () {
                assert.ok('error' in checkPublicPath(path, 'aura'));
            });
        }

        it('refuses what is not a string', function () {
            assert.ok('error' in checkPublicPath(undefined, 'aura'));
            assert.ok('error' in checkPublicPath(42, 'aura'));
        });
    });

    describe('add', function () {
        it('logs every path it takes', function () {
            const l = logger();
            new PublicRoutes(l).add('aura.0', [{ path: '/aura/mcp', handler: answer('a') }]);
            assert.strictEqual(l.log.info.length, 1);
            assert.match(l.log.info[0], /"aura\.0" answers "\/aura\/mcp" itself/);
        });

        it('refuses a path of another adapter', function () {
            const l = logger();
            const routes = new PublicRoutes(l);
            routes.add('aura.0', [{ path: '/vis-2/main', handler: answer('a') }]);
            assert.strictEqual(routes.find('/vis-2/main'), undefined);
            assert.strictEqual(l.log.warn.length, 1);
        });

        it('refuses a path without a handler', function () {
            const l = logger();
            const routes = new PublicRoutes(l);
            routes.add('aura.0', [{ path: '/aura/mcp' }]);
            assert.strictEqual(routes.find('/aura/mcp'), undefined);
            assert.strictEqual(l.log.warn.length, 1);
        });

        it('keeps the first extension that names a path', function () {
            const l = logger();
            const routes = new PublicRoutes(l);
            routes.add('aura.0', [{ path: '/aura/mcp', handler: answer('a') }]);
            routes.add('aura.1', [{ path: '/aura/mcp/', handler: answer('b') }]);
            assert.strictEqual(routes.find('/aura/mcp').instance, 'aura.0');
            assert.strictEqual(l.log.warn.length, 1);
        });

        it('ignores nothing and refuses what is not an array', function () {
            const l = logger();
            const routes = new PublicRoutes(l);
            routes.add('aura.0', undefined);
            routes.add('aura.0', null);
            assert.strictEqual(l.log.warn.length, 0);
            routes.add('aura.0', { path: '/aura/mcp', handler: answer('a') });
            assert.strictEqual(l.log.warn.length, 1);
            assert.strictEqual(routes.find('/aura/mcp'), undefined);
        });
    });

    describe('in front of the login', function () {
        let server;
        let l;

        before(async function () {
            l = logger();
            const routes = new PublicRoutes(l);
            routes.add('aura.0', [
                { path: '/aura', handler: answer('aura.0') },
                { path: '/aura/next', handler: (_req, _res, next) => next() },
                {
                    path: '/aura/raw',
                    handler: (req, res) => {
                        const chunks = [];
                        req.on('data', chunk => chunks.push(chunk));
                        req.on('end', () =>
                            res.send(`${req.body === undefined ? 'unparsed' : 'parsed'} ${Buffer.concat(chunks)}`),
                        );
                    },
                },
                {
                    path: '/aura/throw',
                    handler: () => {
                        throw new Error('broken');
                    },
                },
                { path: '/aura/reject', handler: async () => Promise.reject(new Error('broken')) },
            ]);
            routes.add('aura.1', [{ path: '/aura/mcp', handler: answer('aura.1') }]);
            server = await startServer(routes);
        });

        after(function () {
            server.close();
        });

        // the reason for all of this: a token web did not issue never got past the OAuth2 layer
        it('answers a request with a foreign bearer token', async function () {
            const res = await request(server, '/aura/mcp', { headers: { Authorization: 'Bearer aura-token' } });
            assert.deepStrictEqual(res, { status: 200, body: 'aura.1 /aura/mcp' });
        });

        it('answers the paths below a public path', async function () {
            assert.deepStrictEqual(await request(server, '/aura/mcp/sub/x'), {
                status: 200,
                body: 'aura.1 /aura/mcp/sub/x',
            });
        });

        it('gives the more specific path to its extension', async function () {
            assert.strictEqual((await request(server, '/aura/index.html')).body, 'aura.0 /aura/index.html');
            assert.strictEqual((await request(server, '/aura/mcp')).body, 'aura.1 /aura/mcp');
        });

        it('leaves a path that only starts with the same letters to the login', async function () {
            assert.strictEqual((await request(server, '/auraX/mcp')).status, 401);
            assert.strictEqual((await request(server, '/vis-2/index.html')).status, 401);
        });

        it('leaves a path with another case to the login', async function () {
            assert.strictEqual((await request(server, '/AURA/mcp')).status, 401);
        });

        it('hands the request back to the login when the extension calls next()', async function () {
            assert.deepStrictEqual(await request(server, '/aura/next'), { status: 401, body: 'login required' });
        });

        it('gives the extension the body unparsed', async function () {
            const res = await request(server, '/aura/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"jsonrpc":"2.0"}',
            });
            assert.deepStrictEqual(res, { status: 200, body: 'unparsed {"jsonrpc":"2.0"}' });
        });

        it('answers 500 when the handler throws', async function () {
            assert.strictEqual((await request(server, '/aura/throw')).status, 500);
        });

        it('answers 500 when the handler rejects', async function () {
            assert.strictEqual((await request(server, '/aura/reject')).status, 500);
            assert.ok(l.log.warn.some(message => message.includes('"/aura/reject"')));
        });
    });
});
