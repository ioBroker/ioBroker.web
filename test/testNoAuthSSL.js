'use strict';
const setup = require('@iobroker/legacy-testing');
const tests = require('./lib/tests');

let objects = null;
let states  = null;

process.env.HTTPS_PROXY   = '';
process.env.HTTP_PROXY    = '';
// process.env.JS_CONTROLLER_VERSION = '5.0.5-alpha.0-20230617-464b0fd6';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function initTests() {
    const _tests = tests('https', 18803);
    for (const test in _tests) {
        if (_tests.hasOwnProperty(test)) {
            it(`Test WEB: ${test}`, _tests[test]);
        }
    }
}

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        return cb && cb('Cannot check connection');
    }

    states.getState('system.adapter.web.0.alive', (err, state) => {
        err && console.error(err);
        if (state && state.val) {
            cb && cb();
        } else {
            setTimeout(() => checkConnectionOfAdapter(cb, counter + 1), 1000);
        }
    });
}

describe.skip(`Test WEB(SSL)`, () => {
    before(`Test WEB(SSL): Start js-controller`, function (_done) {
        this.timeout(600000); // because of first install from npm
        setup.adapterStarted = false;

        setup.setupController(async () => {
            const config = await setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'debug';

            if (!config.native) {
                const pack = require('../io-package.json');
                config.native = pack.native;
            }

            config.native.port        = 18803;
            config.native.secure      = true;
            config.native.cache       = false;
            config.native.showFolderIndex = true;
            config.native.certPublic  = config.native.secure ? 'defaultPublic' : '';
            config.native.certPrivate = config.native.secure ? 'defaultPrivate' : '';

            await setup.setAdapterConfig(config.common, config.native);

            setup.startController(true, null, null, (_objects, _states) => {
                objects = _objects;
                states  = _states;
                _done();
            });
        });
    });

    it(`Test WEB(SSL): Check if adapter started`, done => {
        checkConnectionOfAdapter(() => setTimeout(() => done(), 2000));
    }).timeout(10000);

    initTests();

    after(`Test WEB(SSL): Stop js-controller`, function (done) {
        this.timeout(6000);

        setup.stopController(normalTerminated => {
            console.log(`Adapter normal terminated: ${normalTerminated}`);
            setTimeout(done, 3000);
        });
    });
});
