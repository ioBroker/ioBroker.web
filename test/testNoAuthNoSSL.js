'use strict';
const expect  = require('chai').expect;
const setup   = require(__dirname + '/lib/setup');
const request = require('request');
const tests   = require(__dirname + '/lib/tests');

let objects = null;
let states  = null;

process.env.HTTPS_PROXY   = '';
process.env.HTTP_PROXY    = '';
process.env.TEST_PORT     = 18802;
process.env.TEST_PROTOCOL = 'http';

function initTests() {
    for (const test in tests.tests) {
        if (tests.tests.hasOwnProperty(test)) {
            it('Test WEB: ' + test, tests.tests[test]);
        }
    }
}

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        cb && cb('Cannot check connection');
        return;
    }

    states.getState('system.adapter.web.0.alive', (err, state) => {
        if (err) console.error(err);
        if (state && state.val) {
            cb && cb();
        } else {
            setTimeout(() => checkConnectionOfAdapter(cb, counter + 1), 1000);
        }
    });
}

describe('Test WEB', function() {
    before('Test WEB: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm
        setup.adapterStarted = false;

        setup.setupController(() => {
            const config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'debug';

            config.native.port        = process.env.TEST_PORT;
            config.native.secure      = process.env.TEST_PROTOCOL === 'https';
            config.native.cache       = false;
            config.native.certPublic  = 'defaultPublic';
            config.native.certPrivate = 'defaultPrivate';

            setup.setAdapterConfig(config.common, config.native);

            setup.startController(true, null, null, (_objects, _states) => {
                objects = _objects;
                states  = _states;
                _done();
            });
        });
    });

    it('Test WEB: Check if adapter started', done => {
        checkConnectionOfAdapter(() => setTimeout(() => done(), 2000));
    }).timeout(5000);

    initTests();

    after('Test WEB: Stop js-controller', function (done) {
        this.timeout(9000);

        setup.stopController((normalTerminated) => {
            console.log('Adapter normal terminated: ' + normalTerminated);
            setTimeout(done, 3000);
        });
    });
});
