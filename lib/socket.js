const SocketWS = require('./socketWS');
const SocketIO = require('./socketIO');
const ws = require('@iobroker/ws-server');
const SocketCommon = require('./socketCommon');

class Socket {
    constructor(server, settings, adapter, ignore, store, checkUser) {
        const socketOptions = {
            pingInterval: 120000,
            pingTimeout: 30000
        };

        if (adapter.config.usePureWebSockets) {
            this.ioServer = new SocketWS(settings, adapter);
        } else {
            if (settings.forceWebSockets) {
                // socket.io 4.0
                socketOptions.transports = ['websocket'];
            }
            if (settings.compatibilityV2 !== false) {
                // socket.io 4.0
                socketOptions.allowEIO3 = true;
            }
            this.ioServer = new SocketIO(settings, adapter);
        }

        this.ioServer.start(server, ws, {userKey: 'connect.sid', checkUser, store, secret: settings.secret}, socketOptions);
    }

    getWhiteListIpForAddress(remoteIp, whiteListSettings) {
        return SocketCommon.getWhiteListIpForAddress(remoteIp, whiteListSettings);
    }

    publishAll(type, id, obj) {
        return this.ioServer.publishAll(type, id, obj);
    }

    publishFileAll(id, fileName, size) {
        return this.ioServer.publishFileAll(id, fileName, size);
    }

    close() {
        this.ioServer.close();
        this.ioServer = null;
    }
}

module.exports = Socket;
