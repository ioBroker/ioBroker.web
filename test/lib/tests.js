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
