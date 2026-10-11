const assert = require('node:assert');
const express = require('express');
const bodyParser = require('body-parser');
const { bodyParsers, readBodyAsync } = require('../build/lib/utils');

/**
 * Starts a server whose only route answers with the body readBodyAsync returned
 *
 * @param parsers the middlewares in front of the route
 */
function startServer(parsers) {
    const app = express();
    parsers.forEach(parser => app.use(parser));
    app.post('/state/:stateId', async (req, res) => {
        const body = await readBodyAsync(req);
        res.type('application/octet-stream').send(body);
    });
    return new Promise(resolve => {
        const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
}

async function post(server, body, contentType) {
    const headers = contentType ? { 'Content-Type': contentType } : {};
    const res = await fetch(`http://127.0.0.1:${server.address().port}/state/cloud.0.remote.command`, {
        method: 'POST',
        headers,
        body,
    });
    return res.text();
}

const COMMAND = JSON.stringify({ value: 'on', deviceName: 'Phone', name: 'light' });

const SETUPS = {
    'without body-parser in front (authentication off)': () => [],
    // initAuth() installs these when authentication is enabled
    'with the body parsers of the adapter in front (authentication on)': bodyParsers,
};

Object.keys(SETUPS).forEach(setup => {
    describe(`readBodyAsync ${setup}`, function () {
        let server;

        before(async function () {
            server = await startServer(SETUPS[setup]());
        });

        after(function () {
            server.close();
        });

        // the regression: body-parser had read the stream already and the value of the app was lost
        it('a JSON body', async function () {
            assert.deepStrictEqual(JSON.parse(await post(server, COMMAND, 'application/json')), JSON.parse(COMMAND));
        });

        it('a JSON body with a charset', async function () {
            const body = JSON.stringify({ val: 42, ack: true });
            assert.deepStrictEqual(
                JSON.parse(await post(server, body, 'application/json; charset=utf-8')),
                JSON.parse(body),
            );
        });

        it('a text body', async function () {
            assert.strictEqual(await post(server, '23.5', 'text/plain'), '23.5');
        });

        it('a body without a content type', async function () {
            assert.strictEqual(await post(server, Buffer.from('true'), null), 'true');
        });

        it('a body of a type no parser handles', async function () {
            assert.strictEqual(await post(server, COMMAND, 'application/octet-stream'), COMMAND);
        });

        it('an empty body stays empty', async function () {
            assert.strictEqual(await post(server, '', 'application/json'), '');
        });
    });
});

// a parser of a web extension keeps nothing but the parsed result
describe('readBodyAsync behind a parser that keeps no raw body', function () {
    let server;

    before(async function () {
        server = await startServer([bodyParser.json(), bodyParser.text()]);
    });

    after(function () {
        server.close();
    });

    it('a JSON body', async function () {
        assert.deepStrictEqual(JSON.parse(await post(server, COMMAND, 'application/json')), JSON.parse(COMMAND));
    });

    it('a text body', async function () {
        assert.strictEqual(await post(server, '23.5', 'text/plain'), '23.5');
    });
});
