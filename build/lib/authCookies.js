"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAdapterCookieHeader = normalizeAdapterCookieHeader;
exports.namespaceAccessTokenCookie = namespaceAccessTokenCookie;
function normalizeAdapterCookieHeader(cookieHeader, namespace) {
    if (!cookieHeader) {
        return cookieHeader;
    }
    const cookieAliases = {
        [`${namespace}.sid`]: 'connect.sid',
        [`${namespace}.access_token`]: 'access_token',
    };
    return cookieHeader
        .split(';')
        .map(cookie => cookie.trim())
        .filter(Boolean)
        .flatMap(cookie => {
        const separator = cookie.indexOf('=');
        const name = separator === -1 ? cookie : cookie.substring(0, separator);
        const alias = cookieAliases[name];
        if (name === 'connect.sid' || name === 'access_token') {
            return [];
        }
        if (alias) {
            return [`${alias}${cookie.substring(separator)}`];
        }
        return [cookie];
    })
        .join('; ');
}
function namespaceAccessTokenCookie(cookie, namespace) {
    const separator = cookie.indexOf('=');
    if (separator === -1 || cookie.substring(0, separator).trim() !== 'access_token') {
        return cookie;
    }
    return `${namespace}.access_token${cookie.substring(separator)}`;
}
//# sourceMappingURL=authCookies.js.map