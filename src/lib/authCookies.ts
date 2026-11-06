export function normalizeAdapterCookieHeader(cookieHeader: string | undefined, namespace: string): string | undefined {
    if (!cookieHeader) {
        return cookieHeader;
    }

    const cookieAliases: Record<string, string> = {
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

export function namespaceAccessTokenCookie(cookie: string, namespace: string): string {
    const separator = cookie.indexOf('=');
    if (separator === -1 || cookie.substring(0, separator).trim() !== 'access_token') {
        return cookie;
    }

    return `${namespace}.access_token${cookie.substring(separator)}`;
}
