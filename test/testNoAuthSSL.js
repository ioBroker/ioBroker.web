//var expect  = require('chai').expect;
var setup   = require(__dirname + '/lib/setup');
var request = require('request');
var tests   = require(__dirname + '/lib/tests');

var objects = null;
var states  = null;

process.env.HTTPS_PROXY   = '';
process.env.HTTP_PROXY    = '';
process.env.TEST_PORT     = 18803;
process.env.TEST_PROTOCOL = 'https';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function initTests() {
    for (var test in tests.tests) {
        it('Test WEB(' + ((process.env.TEST_PROTOCOL == 'https') ? 'SSL' : 'NO SSL') + '): ' + test, tests.tests[test]);
    }
}

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        cb && cb('Cannot check connection');
        return;
    }

    states.getState('system.adapter.web.0.alive', function (err, state) {
        if (err) console.error(err);
        if (state && state.val) {
            cb && cb();
        } else {
            setTimeout(function () {
                checkConnectionOfAdapter(cb, counter + 1);
            }, 1000);
        }
    });
}

describe('Test WEB(' + ((process.env.TEST_PROTOCOL == 'https') ? 'SSL' : 'NO SSL') + ')', function() {
    before('Test WEB(' + ((process.env.TEST_PROTOCOL == 'https') ? 'SSL' : 'NO SSL') + '): Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm

        setup.setupController(function () {
            var config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'debug';

            config.native.port        = process.env.TEST_PORT;
            config.native.secure      = process.env.TEST_PROTOCOL == 'https';
            config.native.cache       = false;
            config.native.certPublic  = config.native.secure ? 'defaultPublic' : '';
            config.native.certPrivate = config.native.secure ? 'defaultPrivate' : '';

            setup.setAdapterConfig(config.common, config.native);

            setup.startController(true, null, null, function (_objects, _states) {
                objects = _objects;
                states  = _states;
                _done();
            });
        });
    });

    it('Test WEB(' + ((process.env.TEST_PROTOCOL == 'https') ? 'SSL' : 'NO SSL') + '): Check if adapter started', function (done) {
        this.timeout(5000);
        checkConnectionOfAdapter(function () {setTimeout(done, 2000);});
    });

    initTests();

    after('Test WEB(' + ((process.env.TEST_PROTOCOL == 'https') ? 'SSL' : 'NO SSL') + '): Stop js-controller', function (done) {
        this.timeout(6000);

        setup.stopController(function (normalTerminated) {
            console.log('Adapter normal terminated: ' + normalTerminated);
            done();
        });
    });
});
