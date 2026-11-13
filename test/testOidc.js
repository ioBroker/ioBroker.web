'use strict';
const setup = require('@iobroker/legacy-testing');
const axios = require('axios');
const assert = require('node:assert');
const { createServer } = require('node:http');
const { generateKeyPairSync, sign } = require('node:crypto');
const webPort = 18804;
const userListWebPort = 18805;
const clientId = 'web-test-client';
const unlinkedUser = 'oidc-unlinked-test-user';
const linkedUser = 'oidc-linked-test-user';
const linkedSubject = 'oidc-linked-test-subject';
let objects;
let states;
let issuerServer;
let issuer;
let nonce;
let tokenSubject = unlinkedUser;
let signingKey;
let signingJwk;

function sendJson(response, data) {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(data));
}

function createIdToken() {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'web-test-key' })).toString('base64url');
    const payload = Buffer.from(
        JSON.stringify({
            iss: issuer,
            sub: tokenSubject,
            aud: clientId,
            iat: now,
            exp: now + 60,
            nonce,
        }),
    ).toString('base64url');
    const content = `${header}.${payload}`;
    const signature = sign('RSA-SHA256', Buffer.from(content), signingKey).toString('base64url');
    return `${content}.${signature}`;
}

function startIssuer() {
    const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    signingKey = keyPair.privateKey;
    signingJwk = {
        ...keyPair.publicKey.export({ format: 'jwk' }),
        kid: 'web-test-key',
        alg: 'RS256',
        use: 'sig',
    };

    issuerServer = createServer((request, response) => {
        if (request.url === '/.well-known/openid-configuration') {
            return sendJson(response, {
                issuer,
                authorization_endpoint: `${issuer}/authorize`,
                token_endpoint: `${issuer}/token`,
                jwks_uri: `${issuer}/jwks`,
            });
        }
        if (request.url === '/jwks') {
            return sendJson(response, { keys: [signingJwk] });
        }
        if (request.url === '/token') {
            return sendJson(response, {
                access_token: 'provider-access-token',
                token_type: 'Bearer',
                expires_in: 60,
                id_token: createIdToken(),
            });
        }

        response.writeHead(404);
        response.end();
    });

    return new Promise(resolve => {
        issuerServer.listen(0, '127.0.0.1', () => {
            issuer = `http://127.0.0.1:${issuerServer.address().port}`;
            resolve();
        });
    });
}

async function waitForAdapter(port) {
    const baseUrl = `http://localhost:${port}`;
    const deadline = Date.now() + 30000;

    while (Date.now() < deadline) {
        const alive = await new Promise(resolve => {
            states.getState('system.adapter.web.0.alive', (_error, state) => resolve(!!state?.val));
        });
        if (alive) {
            try {
                const response = await axios.get(`${baseUrl}/login/index.html`, {
                    timeout: 1000,
                    validateStatus: () => true,
                });
                if (response.status === 200) {
                    return;
                }
            } catch {
                // The alive state can precede the HTTP listener; retry until the endpoint answers.
            }
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Web adapter HTTP listener did not become ready on port ${port}`);
}

/**
 * Start web with a local identity provider
 *
 * @param port the port of web
 * @param native settings on top of a configured single sign-on
 */
async function startWeb(port, native) {
    await startIssuer();
    setup.adapterStarted = false;

    await new Promise((resolve, reject) => {
        setup.setupController(async () => {
            try {
                const config = await setup.getAdapterConfig();
                config.common.enabled = true;
                config.common.loglevel = 'debug';
                config.native = {
                    ...config.native,
                    auth: true,
                    port,
                    secure: false,
                    cache: false,
                    usePureWebSockets: false,
                    ssoActive: true,
                    oidcIssuer: issuer,
                    oidcClientId: clientId,
                    oidcClientSecret: '',
                    oidcScope: 'openid profile email',
                    publicUrl: `http://localhost:${port}`,
                    ...native,
                };

                await setup.setAdapterConfig(config.common, config.native);
                setup.startController(true, null, null, (_objects, _states) => {
                    objects = _objects;
                    states = _states;
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    });

    await waitForAdapter(port);
}

function stopWeb(done) {
    setup.stopController(normalTerminated => {
        issuerServer.close(() => {
            assert.ok(normalTerminated);
            done();
        });
    });
}

/**
 * Start a single sign-on and let the identity provider come back with a code
 *
 * @param baseUrl the address of web
 * @param code the code the identity provider hands back
 */
async function runSso(baseUrl, code) {
    const start = await axios.get(`${baseUrl}/sso`, {
        params: { method: 'login', redirectUrl: `${baseUrl}/login/index.html` },
        maxRedirects: 0,
        validateStatus: () => true,
    });
    assert.strictEqual(start.status, 302);
    const authorizationUrl = new URL(start.headers.location, baseUrl);
    assert.strictEqual(authorizationUrl.origin, issuer);
    nonce = authorizationUrl.searchParams.get('nonce');
    assert.ok(nonce, `OIDC start redirected to ${authorizationUrl}`);

    return axios.get(`${baseUrl}/sso-callback`, {
        params: { code, state: authorizationUrl.searchParams.get('state') },
        maxRedirects: 0,
        validateStatus: () => true,
    });
}

describe('OIDC authentication', function () {
    const baseUrl = `http://localhost:${webPort}`;

    before('Start Web with a local OIDC issuer', async function () {
        this.timeout(600000);
        await startWeb(webPort, { oauth: true, userListEnabled: false });
    });

    it('rejects an unlinked OIDC subject without creating a user or session', async function () {
        this.timeout(10000);
        const loginPage = await axios.get(`${baseUrl}/login/index.html`);
        assert.ok(loginPage.data.includes("window.loginSso = 'true'"));

        tokenSubject = unlinkedUser;
        const callback = await runSso(baseUrl, 'unlinked-subject-code');

        assert.strictEqual(callback.status, 302);
        const callbackUrl = new URL(callback.headers.location);
        assert.strictEqual(callbackUrl.pathname, '/login/index.html');
        assert.strictEqual(callbackUrl.searchParams.has('ssoCode'), false);
        assert.strictEqual(callback.headers['set-cookie'], undefined);
        assert.strictEqual(await objects.getObjectAsync(`system.user.${unlinkedUser}`), null);
    });

    it('signs a linked OIDC user in as this user, with a one-time code instead of tokens in the URL', async function () {
        this.timeout(10000);
        await objects.setObject(`system.user.${linkedUser}`, {
            _id: `system.user.${linkedUser}`,
            type: 'user',
            common: {
                name: linkedUser,
                enabled: true,
                externalAuthentication: { oidc: { sub: linkedSubject } },
            },
            native: {},
        });

        tokenSubject = linkedSubject;
        const callback = await runSso(baseUrl, 'linked-subject-code');
        assert.strictEqual(callback.status, 302);
        const accessCookie = callback.headers['set-cookie']
            ?.find(cookie => cookie.startsWith('access_token='))
            ?.split(';')[0];
        assert.ok(accessCookie, `SSO should set the access-token cookie: ${JSON.stringify(callback.headers)}`);

        const callbackUrl = new URL(callback.headers.location);
        const ssoCode = callbackUrl.searchParams.get('ssoCode');
        assert.ok(ssoCode);
        assert.strictEqual(callbackUrl.href.includes('provider-access-token'), false);
        assert.strictEqual(callbackUrl.searchParams.has('access_token'), false);

        const exchange = await axios.post(`${baseUrl}/sso-token`, { code: ssoCode });
        assert.strictEqual(exchange.status, 200);
        assert.ok(exchange.data.access_token);
        assert.ok(exchange.data.refresh_token);
        assert.strictEqual(accessCookie.split('=')[1], exchange.data.access_token);

        // The token carries the user who signed in, never another one: it is valid for admin too
        const userResponse = await axios.get(`${baseUrl}/getUser`, {
            headers: { Authorization: `Bearer ${exchange.data.access_token}` },
        });
        assert.strictEqual(userResponse.data.user, linkedUser);
    });

    it('serves the SSO handoff page even when the browser already has a session', async function () {
        const login = await axios.post(
            `${baseUrl}/login`,
            new URLSearchParams({ username: 'admin', password: 'iobroker' }),
            { maxRedirects: 0, validateStatus: () => true },
        );
        assert.strictEqual(login.status, 302);

        const cookies = login.headers['set-cookie']?.map(cookie => cookie.split(';')[0]).join('; ');
        assert.ok(cookies, 'local login should set a session cookie');
        const loginPage = await axios.get(`${baseUrl}/login/index.html?ssoCode=one-time-code`, {
            headers: { Cookie: cookies },
            maxRedirects: 0,
            validateStatus: () => true,
        });
        assert.strictEqual(loginPage.status, 200, `unexpected redirect to ${loginPage.headers.location}`);
        assert.ok(loginPage.data.includes('loginSso'));
    });

    it('continues to accept the local username and password grant', async function () {
        this.timeout(10000);
        const response = await axios.post(
            `${baseUrl}/oauth/token`,
            new URLSearchParams({
                grant_type: 'password',
                username: 'admin',
                password: 'iobroker',
                stayloggedin: 'false',
                client_id: 'ioBroker',
            }),
            { validateStatus: () => true },
        );

        assert.strictEqual(response.status, 200);
        assert.ok(response.data.access_token);
    });

    after('Stop Web and the local OIDC issuer', function (done) {
        this.timeout(15000);
        stopWeb(done);
    });
});

describe('OIDC authentication together with the user list', function () {
    const baseUrl = `http://localhost:${userListWebPort}`;

    before('Start Web with OIDC and the user list enabled', async function () {
        this.timeout(600000);
        await startWeb(userListWebPort, {
            userListEnabled: true,
            userListSettings: {
                users: ['system.user.admin'],
                accessAsUser: 'system.user.admin',
                groups: [],
            },
        });
    });

    it('does not offer the single sign-on, because the user list would put another user into the token', async function () {
        this.timeout(10000);
        const loginPage = await axios.get(`${baseUrl}/login/index.html`);
        assert.ok(loginPage.data.includes("window.loginSso = 'false'"));

        const start = await axios.get(`${baseUrl}/sso`, {
            params: { method: 'login', redirectUrl: `${baseUrl}/login/index.html` },
            maxRedirects: 0,
            validateStatus: () => true,
        });
        const location = start.headers.location ? new URL(start.headers.location, baseUrl) : null;
        assert.notStrictEqual(location?.origin, issuer, 'the browser is not sent to the identity provider');

        const exchange = await axios.post(
            `${baseUrl}/sso-token`,
            { code: 'any-code' },
            { maxRedirects: 0, validateStatus: () => true },
        );
        assert.notStrictEqual(exchange.status, 200);
    });

    after('Stop Web and the local OIDC issuer', function (done) {
        this.timeout(15000);
        stopWeb(done);
    });
});
