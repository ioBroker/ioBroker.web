'use strict';
const setup = require('@iobroker/legacy-testing');
const axios = require('axios');
const assert = require('node:assert');
const { pbkdf2Sync, randomBytes } = require('node:crypto');
const { base32Decode, hotp, totpStep } = require('@iobroker/webserver');

const webPort = 18806;
const baseUrl = `http://localhost:${webPort}`;
const testUser = 'totp-test-user';
const testPassword = 'totp-test-password';
let objects;
let states;

/** Password hash like js-controller creates it */
function hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    return `pbkdf2$10000$${pbkdf2Sync(password, salt, 10000, 256, 'sha256').toString('hex')}$${salt}`;
}

/** Code of the authenticator app, `offset` steps from now */
function codeFor(secret, offset = 0) {
    return hotp(base32Decode(secret), totpStep() + offset);
}

async function waitForAdapter() {
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
    throw new Error(`Web adapter HTTP listener did not become ready on port ${webPort}`);
}

function tokenLogin(otp) {
    const params = new URLSearchParams({
        grant_type: 'password',
        username: testUser,
        password: testPassword,
        client_id: 'ioBroker',
    });
    if (otp !== undefined) {
        params.set('otp', otp);
    }
    return axios.post(`${baseUrl}/oauth/token`, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true,
    });
}

function formLogin(form) {
    return axios.post(`${baseUrl}/login?href=/`, new URLSearchParams(form).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
        validateStatus: () => true,
    });
}

describe('Two-factor authentication (TOTP)', function () {
    let secret;

    before('Start Web with authentication', async function () {
        this.timeout(600000);
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
                        port: webPort,
                        secure: false,
                        cache: false,
                        usePureWebSockets: false,
                        loginOauth2: false,
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

        await waitForAdapter();

        await objects.setObject(`system.user.${testUser}`, {
            _id: `system.user.${testUser}`,
            type: 'user',
            common: { name: testUser, enabled: true, password: hashPassword(testPassword) },
            native: {},
        });
    });

    it('switches the second factor on through the routes', async function () {
        this.timeout(10000);
        const login = await tokenLogin();
        assert.strictEqual(login.status, 200, JSON.stringify(login.data));
        const headers = { Authorization: `Bearer ${login.data.access_token}` };

        const setupAnswer = await axios.post(`${baseUrl}/2fa/setup`, {}, { headers });
        secret = setupAnswer.data.secret;
        assert.ok(secret);

        const enabled = await axios.post(`${baseUrl}/2fa/enable`, { code: codeFor(secret) }, { headers });
        assert.strictEqual(enabled.data.backupCodes.length, 10);

        const obj = await objects.getObjectAsync(`system.user.${testUser}`);
        const stored = obj.common.externalAuthentication.totp;
        assert.ok(stored.secret);
        assert.notStrictEqual(stored.secret, secret, 'the secret must be stored encrypted');
    });

    it('asks the token endpoint for the code', async function () {
        this.timeout(10000);
        const required = await tokenLogin();
        assert.strictEqual(required.status, 401);
        assert.strictEqual(required.data.error, 'otp_required');

        const invalid = await tokenLogin('000000');
        assert.strictEqual(invalid.status, 401);
        assert.strictEqual(invalid.data.error, 'otp_invalid');
    });

    it('asks for the code in a second step of the login form', async function () {
        this.timeout(10000);
        const first = await formLogin({ username: testUser, password: testPassword });
        assert.strictEqual(first.status, 302);
        const codePage = new URL(first.headers.location, baseUrl);
        assert.strictEqual(codePage.pathname, '/login/index.html');
        const ticket = codePage.searchParams.get('otp');
        assert.ok(ticket, `expected the code step, got ${first.headers.location}`);
        assert.ok(!(first.headers['set-cookie'] || []).some(cookie => cookie.startsWith('connect.sid')));

        const wrong = await formLogin({ otpTicket: ticket, otp: '000000' });
        assert.strictEqual(wrong.status, 302);
        assert.ok(wrong.headers.location.includes(`otp=${ticket}`));
        assert.ok(wrong.headers.location.includes('&error'));

        const ok = await formLogin({ otpTicket: ticket, otp: codeFor(secret, 1) });
        assert.strictEqual(ok.status, 302);
        assert.ok(!ok.headers.location.includes('login/index.html'), ok.headers.location);

        // a ticket is used only once
        const again = await formLogin({ otpTicket: ticket, otp: codeFor(secret, 1) });
        assert.ok(again.headers.location.includes('error'));
    });

    it('answers otp_required to applications', async function () {
        this.timeout(10000);
        const response = await axios.post(
            `${baseUrl}/loginApp`,
            { username: testUser, password: testPassword },
            { validateStatus: () => true },
        );
        assert.strictEqual(response.status, 401);
        assert.strictEqual(response.data.error, 'otp_required');
    });

    after('Stop js-controller', function (done) {
        this.timeout(10000);
        setup.stopController(normalTerminated => {
            assert.ok(normalTerminated);
            done();
        });
    });
});
