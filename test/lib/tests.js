var request = require('request');
var expect  = require('chai').expect;

var tests = {
    'read lib/js file': function (done) {
        this.timeout(2000);
        request(process.env.TEST_PROTOCOL + '://localhost:' + process.env.TEST_PORT + '/lib/js/selectID.js', function (error, response, body) {
            expect(error).to.be.not.ok;
            expect(response.statusCode).to.be.equal(200);
            expect(response.headers['content-type'].split(';')[0]).to.be.equal('application/javascript');
            done();
        });
    },

    'read css file': function (done) {
        this.timeout(2000);
        request(process.env.TEST_PROTOCOL + '://localhost:' + process.env.TEST_PORT + '/lib/css/fancytree/ui.fancytree.min.css', function (error, response, body) {
            expect(error).to.be.not.ok;
            expect(response.statusCode).to.be.equal(200);
            expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/css');
            done();
        });
    },

    'read png file': function (done) {
        this.timeout(2000);
        request(process.env.TEST_PROTOCOL + '://localhost:' + process.env.TEST_PORT + '/lib/css/fancytree/device.png', function (error, response, body) {
            expect(error).to.be.not.ok;
            expect(response.statusCode).to.be.equal(200);
            expect(response.headers['content-type'].split(';')[0]).to.be.equal('image/png');
            done();
        });
    },
    
    'read admin file': function (done) {
        this.timeout(2000);
        request(process.env.TEST_PROTOCOL + '://localhost:' + process.env.TEST_PORT + '/adapter/web/index.html', function (error, response, body) {
            expect(error).to.be.not.ok;
            expect(response.headers['content-type'].split(';')[0]).to.be.equal('text/html');
            expect(response.statusCode).to.be.equal(200);
            done();
        });
    },
    
    'read state that exists': function (done) {
        this.timeout(2000);
        request(process.env.TEST_PROTOCOL + '://localhost:' + process.env.TEST_PORT + '/state/system.adapter.web.0.alive', function (error, response, body) {
            expect(error).to.be.not.ok;
            expect(response.statusCode).to.be.equal(200);
            done();
        });
    },
    
    'read state that not exists': function (done) {
        this.timeout(2000);
        request(process.env.TEST_PROTOCOL + '://localhost:' + process.env.TEST_PORT + '/state/system.adapter.web.1.alive', function (error, response, body) {
            expect(error).to.be.not.ok;
            expect(response.statusCode).to.be.equal(404);
            done();
        });
    },
    
    'read file that does not exist': function (done) {
        this.timeout(2000);
        request(process.env.TEST_PROTOCOL + '://localhost:' + process.env.TEST_PORT + '/adapter/web/index1.html', function (error, response, body) {
            expect(error).to.be.not.ok;
            expect(response.statusCode).to.be.equal(404);
            done();
        });
    }
};
module.exports.tests = tests;
