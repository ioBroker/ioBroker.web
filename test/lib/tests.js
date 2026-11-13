const axios = require('axios');
const assert = require('node:assert');

// `mime-types` >= 3 returns the WHATWG standard `text/javascript`, older versions
// returned the now obsolete `application/javascript`. Both are valid for JS files.
const JS_CONTENT_TYPES = ['text/javascript', 'application/javascript'];

const tests = (protocol, port) => ({
    'read lib/js file': function (done) {
        this.timeout(40000);
        console.log(`${protocol}://localhost:${port}/adapter/web/index_m.html`);
        console.log(`${protocol}://localhost:${port}/lib/js/selectID.js`);
        setTimeout(() => {
            axios(`${protocol}://localhost:${port}/lib/js/selectID.js`)
                .then(response => {
                    assert.strictEqual(response.status, 200);
                    assert.ok(
                        JS_CONTENT_TYPES.includes(response.headers['content-type'].split(';')[0]),
                        `Unexpected content-type: ${response.headers['content-type']}`,
                    );
                    done();
                })
                .catch(done);
        }, 29000);
    },

    'read css file': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/lib/css/fancytree/ui.fancytree.min.css`)
            .then(response => {
                assert.strictEqual(response.status, 200);
                assert.strictEqual(response.headers['content-type'].split(';')[0], 'text/css');
                done();
            })
            .catch(done);
    },

    'read png file': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/lib/css/fancytree/device.png`)
            .then(response => {
                assert.strictEqual(response.status, 200);
                assert.strictEqual(response.headers['content-type'].split(';')[0], 'image/png');
                done();
            })
            .catch(done);
    },

    'read admin file': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/adapter/web/index_m.html`)
            .then(response => {
                assert.strictEqual(response.headers['content-type'].split(';')[0], 'text/html');
                assert.strictEqual(response.status, 200);
                done();
            })
            .catch(done);
    },

    'read state that exists': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/state/system.adapter.web.0.alive`)
            .then(response => {
                assert.strictEqual(response.status, 200);
                done();
            })
            .catch(done);
    },

    'read state that not exists': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/state/system.adapter.web.1.alive`, { validateStatus: () => true })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },

    'read file that does not exist': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/adapter/web/index1.html`, { validateStatus: () => true })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },
    'read index.html': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/index.html`)
            .then(response => {
                assert.strictEqual(response.status, 200);
                assert.strictEqual(response.headers['content-type'].split(';')[0], 'text/html');
                done();
            })
            .catch(done);
    },
    'read /': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/`)
            .then(response => {
                assert.strictEqual(response.status, 200);
                assert.strictEqual(response.headers['content-type'].split(';')[0], 'text/html');
                done();
            })
            .catch(done);
    },
    'OIDC endpoints are unavailable when SSO is disabled': function (done) {
        this.timeout(2000);
        // Without OIDC, the library does not register these routes. The static-file fallback may
        // canonicalize the path with a trailing slash before returning its not-found response.
        Promise.all([
            axios.get(`${protocol}://localhost:${port}/sso`, {
                params: { method: 'login', redirectUrl: `${protocol}://localhost:${port}/` },
                maxRedirects: 0,
                validateStatus: () => true,
            }),
            axios.get(`${protocol}://localhost:${port}/sso-callback`, {
                params: { code: 'test-code', state: 'test-state' },
                maxRedirects: 0,
                validateStatus: () => true,
            }),
            axios.post(`${protocol}://localhost:${port}/sso-token`, null, {
                maxRedirects: 0,
                validateStatus: () => true,
            }),
        ])
            .then(responses => {
                for (const [index, response] of responses.entries()) {
                    if (index === 2) {
                        assert.strictEqual(response.status, 404);
                        continue;
                    }

                    assert.ok([301, 404].includes(response.status));
                    if (response.status === 301) {
                        const destination = new URL(response.headers.location, response.config.url);
                        assert.strictEqual(destination.origin, new URL(response.config.url).origin);
                        assert.strictEqual(
                            destination.pathname,
                            `${new URL(response.config.url).pathname}/`,
                            'only the static fallback trailing-slash redirect is expected',
                        );
                    }
                }
                done();
            })
            .catch(done);
    },
    'read /..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd`, {
            validateStatus: () => true,
        })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },

    'read //..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd`, {
            validateStatus: () => true,
        })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },

    'read /..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/..%5cREADME.md`, { validateStatus: () => true })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },
    'read /..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/..%5c..%5cREADME.md`, { validateStatus: () => true })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },
    'read ////..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}////..%5c..%5cREADME.md`, { validateStatus: () => true })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },
    'read \\..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}\\..%5c..%5cREADME.md`, { validateStatus: () => true })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },
    'read /web/..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/web/..%5c..%5cREADME.md`, { validateStatus: () => true })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },

    'POST state that exists with plain value': function (done) {
        this.timeout(2000);
        axios
            .post(`${protocol}://localhost:${port}/state/system.adapter.web.0.cpu`, '100', {
                headers: { 'Content-Type': 'text/plain' },
            })
            .then(response => {
                assert.strictEqual(response.status, 200);
                assert.ok(response.data.id);
                assert.strictEqual(response.data.id, 'system.adapter.web.0.cpu');
                done();
            })
            .catch(done);
    },

    'POST state that exists with JSON object': function (done) {
        this.timeout(2000);
        axios
            .post(
                `${protocol}://localhost:${port}/state/system.adapter.web.0.cpu`,
                { val: 100 },
                {
                    headers: { 'Content-Type': 'application/json' },
                },
            )
            .then(response => {
                assert.strictEqual(response.status, 200);
                assert.ok(response.data.id);
                assert.strictEqual(response.data.id, 'system.adapter.web.0.cpu');
                done();
            })
            .catch(done);
    },

    'POST state that exists with JSON object including ack': function (done) {
        this.timeout(2000);
        axios
            .post(
                `${protocol}://localhost:${port}/state/system.adapter.web.0.cpu`,
                { val: true, ack: true },
                {
                    headers: { 'Content-Type': 'application/json' },
                },
            )
            .then(response => {
                assert.strictEqual(response.status, 200);
                assert.ok(response.data.id);
                assert.strictEqual(response.data.id, 'system.adapter.web.0.cpu');
                done();
            })
            .catch(done);
    },

    'POST state that does not exist': function (done) {
        this.timeout(2000);
        axios
            .post(`${protocol}://localhost:${port}/state/system.adapter.web.1.cpu`, 'true', {
                validateStatus: () => true,
                headers: { 'Content-Type': 'text/plain' },
            })
            .then(response => {
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(done);
    },

    'POST state and verify value was set': function (done) {
        this.timeout(4000);
        // First POST a value
        axios
            .post(`${protocol}://localhost:${port}/state/system.adapter.web.0.cpu`, '180', {
                headers: { 'Content-Type': 'text/plain' },
            })
            .then(response => {
                assert.strictEqual(response.status, 200);
                // Then GET the value to verify it was set
                return axios(`${protocol}://localhost:${port}/state/system.adapter.web.0.cpu`);
            })
            .then(response => {
                assert.strictEqual(response.status, 200);
                assert.strictEqual(response.data, 180);
                done();
            })
            .catch(done);
    },
});

module.exports = tests;
