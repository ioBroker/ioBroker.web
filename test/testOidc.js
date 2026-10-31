'use strict';
const setup = require('@iobroker/legacy-testing');
const axios = require('axios');
const assert = require('node:assert');
const { createServer } = require('node:http');
const { createHash, generateKeyPairSync, randomBytes, sign } = require('node:crypto');
const io = require('socket.io-client');
const WebSocket = require('ws');
const { normalizeAdapterCookieHeader } = require('../build/lib/authCookies');

const webPort = 18804;
const defaultUserListWebPort = 18805;
const clientId = 'web-test-client';
const unlinkedUser = 'oidc-unlinked-test-user';
const linkedUser = 'oidc-linked-test-user';
const linkedSubject = 'oidc-linked-test-subject';
const mappedUser = 'oidc-mapped-test-user';
let objects;
let states;
let issuerServer;
let issuer;
let nonce;
let mappedAccessCookie;
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

function assertSocketAuthentication(baseUrl, cookie) {
    const socket = io(baseUrl, {
        autoConnect: false,
        extraHeaders: { Cookie: cookie },
        reconnection: false,
        timeout: 5000,
    });

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => finish(new Error('Socket authentication timed out')), 5000);
        const finish = error => {
            clearTimeout(timeout);
            socket.close();
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        socket.once('connect', () => finish());
        socket.once('reauthenticate', () => finish(new Error('Socket rejected the namespaced access-token cookie')));
        socket.once('connect_error', finish);
        socket.connect();
    });
}

function assertPureWebSocketAuthentication(baseUrl, cookie) {
    const url = `${baseUrl.replace(/^http/, 'ws')}/?sid=${Date.now()}`;
    const socket = new WebSocket(url, { headers: { Cookie: cookie } });

    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => finish(new Error('WebSocket authentication timed out')), 5000);
        const finish = error => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            socket.close();
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };

        socket.on('message', data => {
            try {
                const message = JSON.parse(data.toString());
                if (message.includes('___ready___')) {
                    finish();
                } else if (message.includes('reauthenticate')) {
                    finish(new Error('Pure WebSocket rejected the namespaced access-token cookie'));
                }
            } catch {
                finish(new Error('Pure WebSocket returned an invalid handshake message'));
            }
        });
        socket.once('error', finish);
        socket.once('close', () => {
            if (!settled) {
                finish(new Error('Pure WebSocket closed before authentication completed'));
            }
        });
    });
}

describe('Web authentication cookie isolation', function () {
    it('exposes only this instance cookies under conventional extension aliases', function () {
        const cookieHeader = normalizeAdapterCookieHeader(
            'access_token=foreign; connect.sid=foreign-session; web.0.access_token=web-token; web.0.sid=web-session; other=value',
            'web.0',
        );

        assert.strictEqual(cookieHeader, 'access_token=web-token; connect.sid=web-session; other=value');
    });
});

describe('OIDC authentication', function () {
    before('Start Web with a local OIDC issuer', async function () {
        this.timeout(600000);
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
                        oauth: true,
                        port: webPort,
                        secure: false,
                        cache: false,
                        usePureWebSockets: false,
                        ssoActive: true,
                        oidcIssuer: issuer,
                        oidcClientId: clientId,
                        oidcClientSecret: '',
                        oidcScope: 'openid profile email',
                        publicUrl: `http://localhost:${webPort}`,
                        userListEnabled: true,
                        userListSettings: {
                            users: ['system.user.admin', `system.user.${linkedUser}`],
                            accessAsUser: `system.user.${mappedUser}`,
                            groups: [],
                        },
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

        await waitForAdapter(webPort);
        await objects.setObject(`system.user.${mappedUser}`, {
            _id: `system.user.${mappedUser}`,
            type: 'user',
            common: { name: mappedUser, groups: [] },
            native: {},
        });
    });

    it('rejects an unlinked OIDC subject without creating a user or session', async function () {
        this.timeout(10000);
        const baseUrl = `http://localhost:${webPort}`;
        const redirectUrl = `${baseUrl}/login/index.html`;
        const loginPage = await axios.get(`${baseUrl}/login/index.html`);
        assert.ok(loginPage.data.includes("window.loginSso = 'true'"));
        const start = await axios.get(`${baseUrl}/sso`, {
            params: { method: 'login', redirectUrl },
            maxRedirects: 0,
            validateStatus: () => true,
        });

        assert.strictEqual(start.status, 302);
        assert.ok(start.headers.location, JSON.stringify(start.headers));
        const authorizationUrl = new URL(start.headers.location, baseUrl);
        assert.strictEqual(authorizationUrl.origin, issuer);
        nonce = authorizationUrl.searchParams.get('nonce');
        assert.ok(nonce, `OIDC start redirected to ${authorizationUrl}`);

        const callback = await axios.get(`${baseUrl}/sso-callback`, {
            params: { code: 'unlinked-subject-code', state: authorizationUrl.searchParams.get('state') },
            maxRedirects: 0,
            validateStatus: () => true,
        });

        assert.strictEqual(callback.status, 302);
        assert.ok(callback.headers.location, JSON.stringify(callback.headers));
        const callbackUrl = new URL(callback.headers.location);
        assert.strictEqual(callbackUrl.pathname, '/login/index.html');
        assert.strictEqual(callbackUrl.searchParams.has('ssoCode'), false);
        assert.strictEqual(callback.headers['set-cookie'], undefined);
        assert.strictEqual(await objects.getObjectAsync(`system.user.${unlinkedUser}`), null);
    });

    it('applies the user-list account to a linked OIDC user', async function () {
        this.timeout(10000);
        await objects.setObject(`system.user.${linkedUser}`, {
            _id: `system.user.${linkedUser}`,
            type: 'user',
            common: {
                name: linkedUser,
                externalAuthentication: { oidc: { sub: linkedSubject } },
            },
            native: {},
        });

        tokenSubject = linkedSubject;
        const baseUrl = `http://localhost:${webPort}`;
        const start = await axios.get(`${baseUrl}/sso`, {
            params: {
                method: 'login',
                redirectUrl: `${baseUrl}/login/index.html`,
            },
            maxRedirects: 0,
            validateStatus: () => true,
        });
        const authorizationUrl = new URL(start.headers.location, baseUrl);
        nonce = authorizationUrl.searchParams.get('nonce');

        const callback = await axios.get(`${baseUrl}/sso-callback`, {
            params: { code: 'linked-subject-code', state: authorizationUrl.searchParams.get('state') },
            maxRedirects: 0,
            validateStatus: () => true,
        });
        assert.strictEqual(callback.status, 302);
        mappedAccessCookie = callback.headers['set-cookie']
            ?.find(cookie => cookie.startsWith('web.0.access_token='))
            ?.split(';')[0];
        assert.ok(mappedAccessCookie, 'SSO should set the mapped user access-token cookie');

        const callbackUrl = new URL(callback.headers.location);
        const ssoCode = callbackUrl.searchParams.get('ssoCode');
        assert.ok(ssoCode);
        assert.strictEqual(callbackUrl.href.includes('provider-access-token'), false);
        assert.strictEqual(callbackUrl.searchParams.has('access_token'), false);

        const exchange = await axios.post(`${baseUrl}/sso-token`, { code: ssoCode });
        assert.strictEqual(exchange.status, 200);
        assert.ok(exchange.data.access_token);
        assert.ok(exchange.data.refresh_token);
        assert.strictEqual(mappedAccessCookie.split('=')[1], exchange.data.access_token);

        const legacyCookie = mappedAccessCookie.replace('web.0.access_token=', 'access_token=');
        const legacyUserResponse = await axios.get(`${baseUrl}/getUser`, {
            headers: { Cookie: legacyCookie, Accept: 'text/html' },
            maxRedirects: 0,
            validateStatus: () => true,
        });
        assert.strictEqual(legacyUserResponse.status, 302);

        const userResponse = await axios.get(`${baseUrl}/getUser`, {
            headers: { Cookie: mappedAccessCookie },
        });
        assert.strictEqual(userResponse.data.user, mappedUser);

        await assertSocketAuthentication(baseUrl, mappedAccessCookie);
    });

    it('does not reapply the user-list mapping to an authorization-code session user', async function () {
        this.timeout(10000);
        const baseUrl = `http://localhost:${webPort}`;
        const redirectUri = 'http://localhost/oauth-callback';
        const registration = await axios.post(`${baseUrl}/oauth/register`, {
            client_name: 'User List regression test',
            redirect_uris: [redirectUri],
        });
        assert.strictEqual(registration.status, 201);

        assert.ok(mappedAccessCookie, 'run after the mapped OIDC login test');

        const verifier = randomBytes(32).toString('base64url');
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        const authorize = await axios.get(`${baseUrl}/oauth/authorize`, {
            params: {
                response_type: 'code',
                client_id: registration.data.client_id,
                redirect_uri: redirectUri,
                code_challenge: challenge,
                code_challenge_method: 'S256',
            },
            headers: { Cookie: mappedAccessCookie },
        });
        const requestId = authorize.data.match(/name="request_id" value="([^"]+)"/)?.[1];
        assert.ok(requestId, 'authorization page should contain a request id');
        assert.ok(authorize.data.includes(mappedUser), 'consent should use the mapped session user');

        const consent = await axios.post(
            `${baseUrl}/oauth/authorize`,
            new URLSearchParams({ action: 'allow', request_id: requestId }),
            { headers: { Cookie: mappedAccessCookie }, maxRedirects: 0, validateStatus: () => true },
        );
        assert.strictEqual(consent.status, 302);
        const authorizationCode = new URL(consent.headers.location).searchParams.get('code');
        assert.ok(authorizationCode, 'consent should return an authorization code');

        const token = await axios.post(
            `${baseUrl}/oauth/token`,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: authorizationCode,
                code_verifier: verifier,
                client_id: registration.data.client_id,
                redirect_uri: redirectUri,
            }),
        );
        assert.strictEqual(token.status, 200);
        const userResponse = await axios.get(`${baseUrl}/getUser`, {
            headers: { Authorization: `Bearer ${token.data.access_token}` },
        });
        assert.strictEqual(userResponse.data.user, mappedUser);
    });

    it('rejects a linked OIDC user outside the user list', async function () {
        const deniedUser = 'oidc-denied-test-user';
        const deniedSubject = 'oidc-denied-test-subject';
        await objects.setObject(`system.user.${deniedUser}`, {
            _id: `system.user.${deniedUser}`,
            type: 'user',
            common: {
                name: deniedUser,
                externalAuthentication: { oidc: { sub: deniedSubject } },
            },
            native: {},
        });

        tokenSubject = deniedSubject;
        const baseUrl = `http://localhost:${webPort}`;
        const start = await axios.get(`${baseUrl}/sso`, {
            params: {
                method: 'login',
                redirectUrl: `${baseUrl}/login/index.html`,
            },
            maxRedirects: 0,
            validateStatus: () => true,
        });
        const authorizationUrl = new URL(start.headers.location, baseUrl);
        nonce = authorizationUrl.searchParams.get('nonce');

        const callback = await axios.get(`${baseUrl}/sso-callback`, {
            params: { code: 'denied-subject-code', state: authorizationUrl.searchParams.get('state') },
            maxRedirects: 0,
            validateStatus: () => true,
        });

        assert.strictEqual(callback.status, 302);
        assert.strictEqual(new URL(callback.headers.location).searchParams.has('ssoCode'), false);
        assert.strictEqual(callback.headers['set-cookie'], undefined);
    });

    it('serves the SSO handoff page even when the browser already has a session', async function () {
        const baseUrl = `http://localhost:${webPort}`;
        const login = await axios.post(
            `${baseUrl}/login`,
            new URLSearchParams({ username: 'admin', password: 'iobroker' }),
            { maxRedirects: 0, validateStatus: () => true },
        );
        assert.strictEqual(login.status, 302);

        const cookies = login.headers['set-cookie']?.map(cookie => cookie.split(';')[0]).join('; ');
        assert.ok(cookies, 'local login should set a session cookie');
        const sessionCookie = cookies.split('; ').find(cookie => cookie.startsWith('web.0.sid='));
        assert.ok(sessionCookie, 'Web should use an instance-specific session cookie');

        const foreignSession = `connect.sid=${sessionCookie.split('=')[1]}`;
        const userResponse = await axios.get(`${baseUrl}/getUser`, {
            headers: { Cookie: foreignSession, Accept: 'text/html' },
            maxRedirects: 0,
            validateStatus: () => true,
        });
        assert.strictEqual(userResponse.status, 302);
        assert.ok(userResponse.headers.location.startsWith('/login/index.html?href='));

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
            `http://localhost:${webPort}/oauth/token`,
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
        setup.stopController(normalTerminated => {
            issuerServer.close(() => {
                assert.ok(normalTerminated);
                done();
            });
        });
    });
});

describe('OIDC authentication with the default User List setting', function () {
    before('Start Web with OIDC and the User List disabled', async function () {
        this.timeout(600000);
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
                        port: defaultUserListWebPort,
                        secure: false,
                        cache: false,
                        ssoActive: true,
                        oidcIssuer: issuer,
                        oidcClientId: clientId,
                        oidcClientSecret: '',
                        oidcScope: 'openid profile email',
                        publicUrl: `http://localhost:${defaultUserListWebPort}`,
                        userListEnabled: false,
                        usePureWebSockets: true,
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

        await waitForAdapter(defaultUserListWebPort);
        await objects.setObject(`system.user.${linkedUser}`, {
            _id: `system.user.${linkedUser}`,
            type: 'user',
            common: {
                name: linkedUser,
                externalAuthentication: { oidc: { sub: linkedSubject } },
            },
            native: {},
        });
    });

    it('normalizes the OIDC user ID without applying a User List mapping', async function () {
        this.timeout(10000);
        tokenSubject = linkedSubject;
        const baseUrl = `http://localhost:${defaultUserListWebPort}`;
        const start = await axios.get(`${baseUrl}/sso`, {
            params: { method: 'login', redirectUrl: `${baseUrl}/login/index.html` },
            maxRedirects: 0,
            validateStatus: () => true,
        });
        assert.strictEqual(start.status, 302);
        const authorizationUrl = new URL(start.headers.location, baseUrl);
        nonce = authorizationUrl.searchParams.get('nonce');

        const callback = await axios.get(`${baseUrl}/sso-callback`, {
            params: { code: 'default-user-list-code', state: authorizationUrl.searchParams.get('state') },
            maxRedirects: 0,
            validateStatus: () => true,
        });
        assert.strictEqual(callback.status, 302);
        const accessTokenCookie = callback.headers['set-cookie']
            ?.find(cookie => cookie.startsWith('web.0.access_token='))
            ?.split(';')[0];
        assert.ok(accessTokenCookie);
        const ssoCode = new URL(callback.headers.location).searchParams.get('ssoCode');
        assert.ok(ssoCode);

        const exchange = await axios.post(`${baseUrl}/sso-token`, { code: ssoCode });
        const userResponse = await axios.get(`${baseUrl}/getUser`, {
            headers: { Authorization: `Bearer ${exchange.data.access_token}` },
        });
        assert.strictEqual(userResponse.data.user, linkedUser);

        await assertPureWebSocketAuthentication(baseUrl, accessTokenCookie);
    });

    after('Stop Web and the local OIDC issuer', function (done) {
        this.timeout(15000);
        setup.stopController(normalTerminated => {
            issuerServer.close(() => {
                assert.ok(normalTerminated);
                done();
            });
        });
    });
});