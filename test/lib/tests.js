const axios = require('axios');
const expect = require('chai').expect;

const tests = {
    'read lib/js file': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/lib/js/selectID.js`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('application/javascript');
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read css file': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/lib/css/fancytree/ui.fancytree.min.css`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/css');
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read png file': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/lib/css/fancytree/device.png`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('image/png');
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read admin file': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/adapter/web/index_m.html`)
            .then(response => {
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/html');
                expect(response.status).to.be.equal(200);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read state that exists': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/state/system.adapter.web.0.alive`)
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
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/state/system.adapter.web.1.alive`, {validateStatus: status => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read file that does not exist': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/adapter/web/index1.html`, {validateStatus: status => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read index.html': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/index.html`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/html');
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read /': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/`)
            .then(response => {
                expect(response.status).to.be.equal(200);
                expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/html');
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read /..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd`, {validateStatus: status => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read //..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/..%5c..%5c..%5c..%5c..%5c..%5cetc/passwd`, {validateStatus: status => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },

    'read /..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/..%5cREADME.md`, {validateStatus: status => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read /..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/..%5c..%5cREADME.md`, {validateStatus: status => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read ////..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}////..%5c..%5cREADME.md`, {validateStatus: status => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read \\..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}\\..%5c..%5cREADME.md`, {validateStatus: status => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    },
    'read /web/..%5c..%5cREADME.md': function (done) {
        this.timeout(2000);
        axios(`${process.env.TEST_PROTOCOL}://localhost:${process.env.TEST_PORT}/web/..%5c..%5cREADME.md`, {validateStatus: status => true})
            .then(response => {
                expect(response.status).to.be.equal(404);
                done();
            })
            .catch(error => expect(error).to.be.not.ok);
    }
};
module.exports.tests = tests;
