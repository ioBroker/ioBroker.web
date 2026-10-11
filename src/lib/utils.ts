import type { IncomingMessage } from 'node:http';
import { Buffer } from 'node:buffer';
import bodyParser from 'body-parser';
import type { RequestHandler } from 'express';

/** Url where controller changelog is reachable */
export const CONTROLLER_CHANGELOG_URL = 'https://github.com/ioBroker/ioBroker.js-controller/blob/master/CHANGELOG.md';

/** All possible auto upgrade settings */
export const AUTO_UPGRADE_SETTINGS: ioBroker.AutoUpgradePolicy[] = ['none', 'patch', 'minor', 'major'];

/** Mapping to make it more understandable which upgrades are allowed */
export const AUTO_UPGRADE_OPTIONS_MAPPING: Record<ioBroker.AutoUpgradePolicy, string> = {
    none: 'none',
    patch: 'patch',
    minor: 'patch & minor',
    major: 'patch, minor & major',
};

function ip2int(ip: string): number {
    return ip.split('.').reduce((ipInt, octet) => (ipInt << 8) + parseInt(octet, 10), 0) >>> 0;
}

function findNetworkAddressOfHost(obj: ioBroker.HostObject, localIp: string): null | string {
    const networkInterfaces = obj?.native?.hardware?.networkInterfaces;
    if (!networkInterfaces) {
        return null;
    }

    let hostIp: string | null = null;
    for (const networkInterface of Object.values(networkInterfaces)) {
        if (!networkInterface) {
            continue;
        }
        for (let i = 0; i < networkInterface.length; i++) {
            const ip = networkInterface[i];
            if (ip.internal) {
                continue;
            }
            if (localIp.includes(':') && ip.family !== 'IPv6') {
                continue;
            }
            if (localIp.includes('.') && !localIp.match(/[^.\d]/) && ip.family !== 'IPv4') {
                continue;
            }
            if (localIp === '127.0.0.0' || localIp === 'localhost' || localIp.match(/[^.\d]/)) {
                // if DNS name
                hostIp = ip.address;
            } else if (
                ip.family === 'IPv4' &&
                localIp.includes('.') &&
                (ip2int(localIp) & ip2int(ip.netmask)) === (ip2int(ip.address) & ip2int(ip.netmask))
            ) {
                hostIp = ip.address;
            } else {
                hostIp = ip.address;
            }
        }
    }

    if (!hostIp) {
        for (const networkInterface of Object.values(networkInterfaces)) {
            if (!networkInterface) {
                continue;
            }
            for (let i = 0; i < networkInterface.length; i++) {
                const ip = networkInterface[i];
                if (ip.internal) {
                    continue;
                }
                if (localIp.includes(':') && ip.family !== 'IPv6') {
                    continue;
                }
                if (localIp.includes('.') && !localIp.match(/[^.\d]/) && ip.family !== 'IPv4') {
                    continue;
                }
                if (localIp === '127.0.0.0' || localIp === 'localhost' || localIp.match(/[^.\d]/)) {
                    // if DNS name
                    hostIp = ip.address;
                } else {
                    hostIp = ip.address;
                }
            }
        }
    }

    if (!hostIp) {
        for (const networkInterface of Object.values(networkInterfaces)) {
            if (!networkInterface) {
                continue;
            }
            for (let i = 0; i < networkInterface.length; i++) {
                const ip = networkInterface[i];
                if (ip.internal) {
                    continue;
                }
                hostIp = ip.address;
            }
        }
    }

    return hostIp;
}

function getHostname(
    instanceObj: ioBroker.InstanceObject,
    objects: Record<string, ioBroker.InstanceObject>,
    hosts: Record<string, ioBroker.HostObject>,
    currentHostname: string,
    adminInstance: string,
): string | null {
    if (!instanceObj?.common) {
        return null;
    }

    let hostname;
    // check if the adapter from the same host as admin
    const adminHost = objects[`system.adapter.${adminInstance}`]?.common?.host;
    if (instanceObj.common.host !== adminHost) {
        // find IP address
        const host = hosts[`system.host.${instanceObj.common.host}`];
        if (host) {
            const ip = findNetworkAddressOfHost(host, currentHostname);
            if (ip) {
                hostname = ip;
            } else {
                console.warn(`Cannot find suitable IP in host ${instanceObj.common.host} for ${instanceObj._id}`);
                return null;
            }
        } else {
            console.warn(`Cannot find host ${instanceObj.common.host} for ${instanceObj._id}`);
            return null;
        }
    } else {
        hostname = currentHostname;
    }

    return hostname;
}

// internal use
function _replaceLink(
    link: string,
    objects: Record<string, ioBroker.InstanceObject>,
    adapterInstance: string,
    attr: string,
    placeholder: string,
    hosts: Record<string, ioBroker.HostObject>,
    hostname: string,
    adminInstance: string,
): string {
    if (attr === 'protocol') {
        attr = 'secure';
    }

    try {
        const object = objects[`system.adapter.${adapterInstance}`];

        if (link && object) {
            if (attr === 'secure') {
                link = link.replace(`%${placeholder}%`, object.native[attr] ? 'https' : 'http');
            } else {
                let value = object.native[attr];
                // workaround for port
                if ((attr === 'webinterfacePort' || attr === 'port') && (!value || value === '0')) {
                    if (object.native.secure === true) {
                        value = 443;
                    } else {
                        value = 80;
                    }
                }

                if (attr === 'bind' || attr === 'ip') {
                    let ip = object.native.bind || object.native.ip;
                    if (ip === '0.0.0.0') {
                        ip = getHostname(object, objects, hosts, hostname, adminInstance);
                    }
                    if (!link.includes(`%${placeholder}%`)) {
                        link = link.replace(`%native_${placeholder}%`, ip || '');
                    } else {
                        link = link.replace(`%${placeholder}%`, ip || '');
                    }
                } else if (!link.includes(`%${placeholder}%`)) {
                    link = link.replace(`%native_${placeholder}%`, value);
                } else {
                    link = link.replace(`%${placeholder}%`, value);
                }
            }
        } else {
            console.log(`Cannot get link ${attr}`);
            link = link.replace(`%${placeholder}%`, '');
        }
    } catch (error) {
        console.log(error);
    }
    return link;
}

/**
 * Convert the template link to string
 *
 * Possible placeholders:
 * `%ip%` - `native.bind` or `native.ip` of this adapter. If it is '0.0.0.0', we are trying to find the host IP that is reachable from the current browser.
 * `%protocol%` - `native.protocol` or `native.secure` of this adapter. The result is 'http' or 'https'.
 * `%s%` - `native.protocol` or `native.secure` of this adapter. The result is '' or 's'. The idea is to use the pattern like "http%s%://..."
 * `%instance%` - instance number
 * `%adapterName_nativeAttr%` - Takes the native value `nativeAttr` of all instances of adapterName. This generates many links if more than one instance installed
 * `%adapterName.x_nativeAttr%` - Takes the native value `nativeAttr` of adapterName.x instance
 *
 * @param link pattern for link
 * @param adapter adapter name
 * @param instance adapter instance number
 * @param context Context object
 * @param context.instances Object with all instances
 * @param context.hostname Actual host name
 * @param context.adminInstance Actual admin instance
 * @param context.hosts Object with all hosts
 */
export function replaceLink(
    link: string,
    adapter: string,
    instance: number,
    context: {
        instances: Record<string, ioBroker.InstanceObject>;
        hostname: string;
        adminInstance: string;
        hosts: Record<string, ioBroker.HostObject>;
    },
): {
    url: string;
    port: number | undefined;
    instance?: string;
}[] {
    const _urls: {
        url: string;
        port: number | undefined;
        instance?: string;
    }[] = [];
    let port: number | undefined;

    if (link) {
        const instanceObj = context.instances[`system.adapter.${adapter}.${instance}`];
        const native = instanceObj?.native || {};

        const placeholders = link.match(/%(\w+)%/g);

        if (placeholders) {
            for (let p = 0; p < placeholders.length; p++) {
                let placeholder = placeholders[p];

                if (placeholder === '%ip%') {
                    let ip: string | null = (native.bind || native.ip) as string;
                    if (!ip || ip === '0.0.0.0') {
                        // Check host
                        ip = getHostname(
                            instanceObj,
                            context.instances,
                            context.hosts,
                            context.hostname,
                            context.adminInstance,
                        );
                    }

                    if (_urls.length) {
                        _urls.forEach(item => (item.url = item.url.replace('%ip%', ip || '')));
                    } else {
                        link = link.replace('%ip%', ip || '');
                    }
                } else if (placeholder === '%protocol%') {
                    const protocolVal: string | boolean = native.secure === undefined ? native.protocol : native.secure;
                    let protocol: 'http' | 'https';
                    if (protocolVal === true || protocolVal === 'true') {
                        protocol = 'https';
                    } else if (protocolVal === false || protocolVal === 'false' || !protocolVal) {
                        protocol = 'http';
                    } else {
                        protocol = protocolVal.toString().replace(/:$/, '') as 'http' | 'https';
                    }

                    if (_urls.length) {
                        _urls.forEach(item => (item.url = item.url.replace('%protocol%', protocol)));
                    } else {
                        link = link.replace('%protocol%', protocol);
                    }
                } else if (placeholder === '%s%') {
                    const protocolVal: string | boolean = native.secure === undefined ? native.protocol : native.secure;
                    let protocol: '' | 's';
                    if (protocolVal === true || protocolVal === 'true') {
                        protocol = 's';
                    } else if (protocolVal === false || protocolVal === 'false' || !protocolVal) {
                        protocol = '';
                    } else {
                        protocol = protocolVal.toString().replace(/:$/, '') as '' | 's';
                    }

                    if (_urls.length) {
                        _urls.forEach(item => (item.url = item.url.replace('%s%', protocol)));
                    } else {
                        link = link.replace('%s%', protocol);
                    }
                } else if (placeholder === '%instance%') {
                    link = link.replace('%instance%', instance.toString());
                    if (_urls.length) {
                        _urls.forEach(item => (item.url = item.url.replace('%instance%', instance.toString())));
                    } else {
                        link = link.replace('%instance%', instance.toString());
                    }
                } else {
                    // remove %%
                    placeholder = placeholder.replace(/%/g, '');

                    if (placeholder.startsWith('native_')) {
                        placeholder = placeholder.substring(7);
                    }

                    // like web.0_port or web_protocol
                    if (!placeholder.includes('_')) {
                        // if only one instance
                        const adapterInstance = `${adapter}.${instance}`;
                        if (_urls.length) {
                            _urls.forEach(
                                item =>
                                    (item.url = _replaceLink(
                                        item.url,
                                        context.instances,
                                        adapterInstance,
                                        placeholder,
                                        placeholder,
                                        context.hosts,
                                        context.hostname,
                                        context.adminInstance,
                                    )),
                            );
                        } else {
                            link = _replaceLink(
                                link,
                                context.instances,
                                adapterInstance,
                                placeholder,
                                placeholder,
                                context.hosts,
                                context.hostname,
                                context.adminInstance,
                            );
                            port = context.instances[`system.adapter.${adapterInstance}`]?.native?.port;
                        }
                    } else {
                        const [adapterInstance, attr] = placeholder.split('_');

                        // if instance number not found
                        if (!adapterInstance.match(/\.[0-9]+$/)) {
                            // list all possible instances
                            let ids: string[];
                            if (adapter === adapterInstance) {
                                // take only this one instance and that's all
                                ids = [`${adapter}.${instance}`];
                            } else {
                                ids = Object.keys(context.instances)
                                    .filter(
                                        id =>
                                            id.startsWith(`system.adapter.${adapterInstance}.`) &&
                                            context.instances[id].common.enabled,
                                    )
                                    .map(id => id.substring(15));

                                // try to get disabled instances
                                if (!ids.length) {
                                    ids = Object.keys(context.instances)
                                        .filter(id => id.startsWith(`system.adapter.${adapterInstance}.`))
                                        .map(id => id.substring(15));
                                }
                            }

                            for (const id of ids) {
                                if (_urls.length) {
                                    const item = _urls.find(t => t.instance === id);
                                    if (item) {
                                        item.url = _replaceLink(
                                            item.url,
                                            context.instances,
                                            id,
                                            attr,
                                            placeholder,
                                            context.hosts,
                                            context.hostname,
                                            context.adminInstance,
                                        );
                                    } else {
                                        // add new
                                        const _link = _replaceLink(
                                            link,
                                            context.instances,
                                            id,
                                            attr,
                                            placeholder,
                                            context.hosts,
                                            context.hostname,
                                            context.adminInstance,
                                        );
                                        const _port: number = context.instances[`system.adapter.${id}`]?.native
                                            ?.port as number;

                                        _urls.push({ url: _link, port: _port, instance: id });
                                    }
                                } else {
                                    const _link = _replaceLink(
                                        link,
                                        context.instances,
                                        id,
                                        attr,
                                        placeholder,
                                        context.hosts,
                                        context.hostname,
                                        context.adminInstance,
                                    );

                                    const _port: number = context.instances[`system.adapter.${id}`]?.native
                                        ?.port as number;
                                    _urls.push({ url: _link, port: _port, instance: id });
                                }
                            }
                        } else {
                            link = _replaceLink(
                                link,
                                context.instances,
                                adapterInstance,
                                attr,
                                placeholder,
                                context.hosts,
                                context.hostname,
                                context.adminInstance,
                            );

                            port = context.instances[`system.adapter.${adapterInstance}`]?.native?.port as number;
                        }
                    }
                }
            }
        }
    }

    if (_urls.length) {
        return _urls;
    }
    return [{ url: link, port }];
}

/** The part of a request that the login redirect helpers read */
export interface LoginRequest {
    /** Body of the posted login form */
    body?: { origin?: string };
    /** Parsed query string of the request */
    query?: Record<string, any>;
}

/**
 * Checks for a control character
 *
 * Browsers remove tab, newline and carriage return from a URL before they parse it, so a target
 * like `/<TAB>/example.com` would turn into the protocol relative `//example.com` and leave this
 * server. Written without a regular expression to keep the `no-control-regex` rule happy.
 *
 * @param str string to check
 */
function hasControlCharacter(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x1f || code === 0x7f) {
            return true;
        }
    }
    return false;
}

/**
 * Reads the page the user asked for before the login page took over
 *
 * The login form posts its own URL back in `origin`, so the target sits in the query string of that
 * URL. An already authenticated user opening a login link carries it in `?href=` instead.
 *
 * @param req request of the login page
 * @returns the requested path, or null if there is none or it does not belong to this server
 */
export function getRequestedPage(req: LoginRequest): string | null {
    const origin: string | undefined = req.body?.origin;
    let href: string | null = null;

    if (origin) {
        const q = origin.indexOf('?');
        if (q !== -1) {
            href = new URLSearchParams(origin.substring(q + 1)).get('href');
        }
    } else if (typeof req.query?.href === 'string') {
        href = req.query.href;
    }

    // only a path on this very server - never another origin
    if (!href || !href.startsWith('/') || href.startsWith('//') || href.includes('\\') || hasControlCharacter(href)) {
        return null;
    }

    return href;
}

/**
 * Page the user is sent to after a successful login
 *
 * @param req request of the login page
 * @returns the requested path, or `../` - the root of this server - if there is none
 */
export function getRedirectPage(req: LoginRequest): string {
    return getRequestedPage(req) || '../';
}

/**
 * URL of the login page that shows the "wrong password" message
 *
 * The requested page is carried along fully encoded, so it survives a failed attempt and the
 * `error` flag stays in the query string, where the login page looks for it.
 *
 * @param loginPage path of the login page
 * @param req request of the failed login
 */
export function getLoginPageWithError(loginPage: string, req: LoginRequest): string {
    return `${loginPage}?href=${encodeURIComponent(getRequestedPage(req) || '/')}&error`;
}

/** A request that went through {@link bodyParsers}: the bytes the parser read, before parsing */
type BodyRequest = IncomingMessage & { body?: unknown; rawBody?: Buffer };

/** Keeps the bytes a parser read, which readBodyAsync() needs: parsed, an empty JSON body is `{}` */
function keepRawBody(req: IncomingMessage, _res: unknown, buf: Buffer): void {
    (req as BodyRequest).rawBody = buf;
}

/** The parsers for form, JSON and text posts that the login and the other authentication routes need */
export function bodyParsers(): RequestHandler[] {
    return [
        bodyParser.urlencoded({ extended: true, verify: keepRawBody }),
        bodyParser.json({ verify: keepRawBody }),
        bodyParser.text({ verify: keepRawBody }),
    ];
}

/**
 * Reads the raw body of a request.
 *
 * With authentication enabled, the {@link bodyParsers} run in front of every route and have already
 * read the stream of a JSON, text or form post: the stream is empty then and the bytes are taken
 * from what the parser kept.
 *
 * @param req the request to read
 * @param options options for reading
 * @param options.limit the maximum number of bytes, 1 MB by default
 */
export async function readBodyAsync(req: BodyRequest, options?: { limit?: number }): Promise<Buffer> {
    if (req.rawBody) {
        return req.rawBody;
    }
    if (req.readableEnded) {
        // Read by some other parser, an extension's for instance, that kept nothing but the result
        const body = req.body;
        if (body === undefined || body === null) {
            return Buffer.alloc(0);
        }
        if (Buffer.isBuffer(body)) {
            return body;
        }
        return Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    }

    const limit = options?.limit ?? 1_000_000;
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        length += buf.length;
        if (length > limit) {
            const err = new Error('Payload Too Large') as Error & { code?: string };
            err.code = 'PAYLOAD_TOO_LARGE';
            throw err;
        }
        chunks.push(buf);
    }
    return Buffer.concat(chunks);
}
