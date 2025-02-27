"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOAuth2Server = createOAuth2Server;
const oauth2_server_1 = __importStar(require("oauth2-server"));
const oauth2_model_1 = require("./oauth2-model");
function createOAuth2Server(adapter, options) {
    const model = new oauth2_model_1.OAuth2Model(adapter, {
        secure: options.secure,
        accessLifetime: options.accessLifetime,
        refreshLifeTime: options.refreshLifetime,
    });
    const oauth = new oauth2_server_1.default({
        model,
        requireClientAuthentication: { password: false, refresh_token: false },
    });
    // Post token.
    options.app.post('/oauth/token', (req, res) => {
        const request = new oauth2_server_1.Request(req);
        const response = new oauth2_server_1.Response(res);
        oauth
            .token(request, response)
            .then((token) => {
            // save access token and refresh token in cookies with expiration time and flags HTTPOnly, Secure.
            const cookieOptions = {
                httpOnly: true, // Makes the cookie inaccessible to client-side JavaScript
                secure: options.secure, // Only send cookie over HTTPS in production
                // expires: token.accessTokenExpiresAt, // Cookie will expire in X hour
                sameSite: 'strict', // Prevents the browser from sending this cookie along with cross-site requests (optional)
            };
            // If expires omitted or set to 0, the cookie will expire at the end of the session (when the browser closes).
            if (req.body.stayloggedin === 'true') {
                cookieOptions.expires = token.accessTokenExpiresAt;
            }
            // Store the access token in a cookie named "access_token"
            res.cookie('access_token', token.accessToken, cookieOptions);
            res.json(token);
        })
            .catch((err) => {
            res.status(err.code || 500).json(err);
        });
    });
    options.app.get('/logout', (_req, res, next) => {
        res.clearCookie('access_token');
        res.clearCookie('refresh_token');
        // the answer will be sent in other middleware
        next();
    });
    options.app.use(model.authorize);
}
//# sourceMappingURL=oauth2.js.map