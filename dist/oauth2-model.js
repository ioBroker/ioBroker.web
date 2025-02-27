"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuth2Model = void 0;
const node_crypto_1 = require("node:crypto");
function generateRandomToken() {
    const bytes = (0, node_crypto_1.randomBytes)(256);
    return (0, node_crypto_1.createHash)('sha1').update(bytes).digest('hex');
}
// ----- OAuth2Model Class -----
// This class implements the model methods required by oauth2-server.
class OAuth2Model {
    // Token lifetimes in seconds
    accessTokenLifetime = 60 * 60; // 1 hour
    refreshTokenLifetime = 60 * 60 * 24 * 30; // 30 days
    adapter;
    secure;
    /**
     * Create a OAuth2model
     *
     * @param adapter ioBroker adapter
     * @param options Options
     * @param options.accessLifetime Access token expiration in seconds
     * @param options.refreshLifeTime Refresh token expiration in seconds
     * @param options.secure Secured connection
     */
    constructor(adapter, options) {
        this.adapter = adapter;
        this.secure = options?.secure || false;
        this.accessTokenLifetime = options?.accessLifetime || this.accessTokenLifetime;
        this.refreshTokenLifetime = options?.refreshLifeTime || this.refreshTokenLifetime;
    }
    getAccessToken = async (bearerToken) => {
        const token = await new Promise(resolve => this.adapter.getSession(`a:${bearerToken}`, resolve));
        if (!token) {
            return null;
        }
        return {
            accessToken: token.token,
            accessTokenExpiresAt: new Date(token.exp),
            client: {
                id: 'ioBroker',
                grants: ['password', 'refresh_token'],
                accessTokenLifetime: this.accessTokenLifetime,
                refreshTokenLifetime: this.refreshTokenLifetime,
            },
            user: {
                id: token.user,
            },
        };
    };
    /**
     * Get client.
     */
    getClient = (_clientId, _clientSecret) => {
        // Just now we do not check the client secret as only one client is allowed
        return Promise.resolve({
            id: 'ioBroker',
            grants: ['password', 'refresh_token'],
            accessTokenLifetime: this.accessTokenLifetime,
            refreshTokenLifetime: this.refreshTokenLifetime,
        });
    };
    authorize = async (req, res, next) => {
        // Check if the user is logged in
        if (!req.user) {
            if (req.headers?.authorization?.startsWith('Bearer ')) {
                const token = await this.getAccessToken(req.headers.authorization.substring(7));
                if (token) {
                    req.user = token.user.id;
                }
                else {
                    res.status(401).send('Unauthorized');
                    return;
                }
            }
            else if (req.headers.cookie) {
                const cookies = req.headers.cookie.split(';').map(c => c.trim().split('='));
                const tokenCookie = cookies.find(c => c[0] === 'access_token');
                if (tokenCookie) {
                    const token = await this.getAccessToken(tokenCookie[1]);
                    if (token) {
                        req.user = token.user.id;
                    }
                    else {
                        // Try to get the refresh token
                        const refreshTokenCookie = cookies.find(c => c[0] === 'refresh_token');
                        if (refreshTokenCookie) {
                            const refreshToken = await this.getRefreshToken(refreshTokenCookie[1]);
                            if (refreshToken) {
                                // Update the access token
                                const newToken = await this.saveToken({
                                    accessToken: generateRandomToken(),
                                    accessTokenExpiresAt: new Date(Date.now() + this.accessTokenLifetime * 1000),
                                    refreshToken: generateRandomToken(),
                                    refreshTokenExpiresAt: new Date(Date.now() + this.refreshTokenLifetime * 1000),
                                }, refreshToken.client, refreshToken.user);
                                if (newToken) {
                                    // Set the new access token in cookie
                                    res.cookie('refresh_token', newToken.refreshToken, {
                                        httpOnly: true, // Makes the cookie inaccessible to client-side JavaScript
                                        secure: this.secure, // Only send cookie over HTTPS
                                        expires: newToken.refreshTokenExpiresAt, // Cookie will expire in X hour
                                        sameSite: 'strict', // Prevents the browser from sending this cookie along with cross-site requests (optional)
                                    });
                                    res.cookie('access_token', newToken.accessToken, {
                                        httpOnly: true, // Makes the cookie inaccessible to client-side JavaScript
                                        secure: this.secure, // Only send cookie over HTTPS
                                        expires: newToken.refreshTokenExpiresAt, // Cookie will expire in X hour
                                        sameSite: 'strict', // Prevents the browser from sending this cookie along with cross-site requests (optional)
                                    });
                                    req.user = newToken.user.id;
                                }
                            }
                        }
                    }
                }
            }
        }
        next();
    };
    /**
     * Get refresh token.
     */
    getRefreshToken = async (bearerToken) => {
        const token = await new Promise(resolve => this.adapter.getSession(`r:${bearerToken}`, resolve));
        if (!token) {
            return null;
        }
        return {
            refreshToken: token.token,
            refreshTokenExpiresAt: new Date(token.exp),
            client: {
                id: 'ioBroker',
                grants: ['password', 'refresh_token'],
                accessTokenLifetime: this.accessTokenLifetime,
                refreshTokenLifetime: this.refreshTokenLifetime,
            },
            user: {
                id: token.user,
            },
        };
    };
    /**
     * Get user.
     */
    getUser = async (username, password) => {
        const result = await new Promise(resolve => this.adapter.checkPassword(username, password, (success, user) => resolve({ success, user })));
        if (!result.success) {
            return null;
        }
        return {
            id: result.user.replace(/^system\.user\./, ''),
        };
    };
    /**
     * Save token.
     */
    saveToken = async (token, client, user) => {
        const data = {
            accessToken: token.accessToken,
            accessTokenExpiresAt: token.accessTokenExpiresAt,
            refreshToken: token.refreshToken,
            refreshTokenExpiresAt: token.refreshTokenExpiresAt,
            user,
            client,
        };
        const accessTokenTtl = Math.floor((token.accessTokenExpiresAt.getTime() - Date.now()) / 1000);
        const refreshTokenTtl = Math.floor((token.refreshTokenExpiresAt.getTime() - Date.now()) / 1000);
        const internalAccessToken = {
            token: token.accessToken,
            exp: token.accessTokenExpiresAt.getTime(),
            user: user.id,
        };
        const internalRefreshToken = {
            token: token.refreshToken,
            exp: token.refreshTokenExpiresAt.getTime(),
            user: user.id,
        };
        await Promise.all([
            new Promise((resolve, reject) => this.adapter.setSession(`a:${data.accessToken}`, accessTokenTtl, internalAccessToken, err => err ? reject(err) : resolve())),
            new Promise((resolve, reject) => this.adapter.setSession(`r:${data.refreshToken}`, refreshTokenTtl, internalRefreshToken, err => err ? reject(err) : resolve())),
        ]);
        return data;
    };
    revokeToken = async (token) => {
        if (token.refreshToken) {
            await this.adapter.destroySession(`r:${token.refreshToken}`);
        }
        else if (token.accessToken) {
            await this.adapter.destroySession(`a:${token.accessToken}`);
        }
        return true;
    };
    verifyScope = (_token, _scope) => {
        return Promise.resolve(true);
    };
}
exports.OAuth2Model = OAuth2Model;
//# sourceMappingURL=oauth2-model.js.map