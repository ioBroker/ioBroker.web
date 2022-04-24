const SocketWS = require('./socketWS');
const ws = require('iobroker.ws.server');
const SocketCommon = require('./socketCommon');

class Socket {
    constructor(server, settings, adapter, ignore, store, checkUser) {
        this.ioServer = new SocketWS(settings, adapter);
        this.ioServer.start(server, ws, {userKey: 'connect.sid', checkUser, store, secret: settings.secret});
    }

    getWhiteListIpForAddress(remoteIp, whiteListSettings) {
        return SocketCommon.getWhiteListIpForAddress(remoteIp, whiteListSettings);
    }

    publishAll(type, id, obj) {
        return this.ioServer.publishAll(type, id, obj);
    }

    close() {
        this.ioServer.close();
        this.ioServer = null;
    }
}

module.exports = Socket;
