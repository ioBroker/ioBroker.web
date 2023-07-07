const axios = require('axios');
const expect = require('chai').expect;

const tests = (protocol, port) => ({
    'read lib/js file': function (done) {
        this.timeout(30000);
        console.log(`${protocol}://localhost:${port}/adapter/web/index_m.html`);
        console.log(`${protocol}://localhost:${port}/lib/js/selectID.js`);
        setTimeout(() => {
            axios(`${protocol}://localhost:${port}/lib/js/selectID.js`)
                .then(response => {
                    expect(response.status).to.be.equal(200);
                    expect(response.headers['content-type'].split(';')[0]).to.be.equal('application/javascript');
                    done();
                })
                .catch(error => expect(error).to.be.not.ok);
        }, 29000);
    },

    'read css file': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/lib/css/fancytree/ui.fancytree.min.css`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/css');
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read png file': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/lib/css/fancytree/device.png`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('image/png');
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read admin file': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/adapter/web/index_m.html`)
            .then(response => {
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/html');
                expect(response.status).to.be.equal(200);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read state that exists': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/state/system.adapter.web.0.alive`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                done();
            })
            .catch(error => {
                expect(error).to.be.not.ok;
            });
    },

    'read state that not exists': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/state/system.adapter.web.1.alive`, {validateStatus: () => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read file that does not exist': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/adapter/web/index1.html`, {validateStatus: () => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read index.html': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/index.html`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/html');
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read /': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/html');
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read /..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd`, {validateStatus: () => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read //..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd`, {validateStatus: () => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read /..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/..%5cREADME.md`, {validateStatus: () => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read /..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/..%5c..%5cREADME.md`, {validateStatus: () => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read ////..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}////..%5c..%5cREADME.md`, {validateStatus: () => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read \\..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}\\..%5c..%5cREADME.md`, {validateStatus: () => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read /web/..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${protocol}://localhost:${port}/web/..%5c..%5cREADME.md`, {validateStatus: () => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    }
});

module.exports = tests;
