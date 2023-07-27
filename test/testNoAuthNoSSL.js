'use strict';
const setup  = require('@iobroker/legacy-testing');
const tests  = require('./lib/tests');

let objects = null;
let states  = null;

process.env.HTTPS_PROXY   = '';
process.env.HTTP_PROXY    = '';
// process.env.JS_CONTROLLER_VERSION = '5.0.5-alpha.0-20230617-464b0fd6';

function initTests() {
    const _tests = tests('http', 18802);
    for (const test in _tests) {
        if (_tests.hasOwnProperty(test)) {
            it(`Test WEB: ${test}`, _tests[test]);
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
        err && console.error(err);
        if (state && state.val) {
            cb && cb();
        } else {
            setTimeout(() => checkConnectionOfAdapter(cb, counter + 1), 1000);
        }
    });
}

describe('Test WEB', function () {
    before('Test WEB: Start js-controller', function (_done) {
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

            config.native.port        = 18802;
            config.native.secure      = false;
            config.native.cache       = false;
            config.native.showFolderIndex = true;
            config.native.certPublic  = 'defaultPublic';
            config.native.certPrivate = 'defaultPrivate';

            await setup.setAdapterConfig(config.common, config.native);

            setup.startController(true, null, null, (_objects, _states) => {
                objects = _objects;
                states  = _states;
                _done();
            });
        });
    });

    it('Test WEB: Check if adapter started', done => {
        checkConnectionOfAdapter(() => setTimeout(() => done(), 2000));
    }).timeout(10000);

    initTests();

    after('Test WEB: Stop js-controller', function (done) {
        this.timeout(9000);

        setup.stopController(normalTerminated => {
            console.log(`Adapter normal terminated: ${normalTerminated}`);
            setTimeout(done, 3000);
        });
    });
});
