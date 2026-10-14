"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_UPGRADE_OPTIONS_MAPPING = exports.AUTO_UPGRADE_SETTINGS = exports.CONTROLLER_CHANGELOG_URL = void 0;
exports.replaceLink = replaceLink;
exports.getRequestedPage = getRequestedPage;
exports.getRedirectPage = getRedirectPage;
exports.getLoginPageWithError = getLoginPageWithError;
exports.bodyParsers = bodyParsers;
exports.readBodyAsync = readBodyAsync;
exports.getCacheControl = getCacheControl;
const node_buffer_1 = require("node:buffer");
const body_parser_1 = __importDefault(require("body-parser"));
/** Url where controller changelog is reachable */
exports.CONTROLLER_CHANGELOG_URL = 'https://github.com/ioBroker/ioBroker.js-controller/blob/master/CHANGELOG.md';
/** All possible auto upgrade settings */
exports.AUTO_UPGRADE_SETTINGS = ['none', 'patch', 'minor', 'major'];
/** Mapping to make it more understandable which upgrades are allowed */
exports.AUTO_UPGRADE_OPTIONS_MAPPING = {
    none: 'none',
    patch: 'patch',
    minor: 'patch & minor',
    major: 'patch, minor & major',
};
function ip2int(ip) {
    return ip.split('.').reduce((ipInt, octet) => (ipInt << 8) + parseInt(octet, 10), 0) >>> 0;
}
function findNetworkAddressOfHost(obj, localIp) {
    const networkInterfaces = obj?.native?.hardware?.networkInterfaces;
    if (!networkInterfaces) {
        return null;
    }
    let hostIp = null;
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
            }
            else if (ip.family === 'IPv4' &&
                localIp.includes('.') &&
                (ip2int(localIp) & ip2int(ip.netmask)) === (ip2int(ip.address) & ip2int(ip.netmask))) {
                hostIp = ip.address;
            }
            else {
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
                }
                else {
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
function getHostname(instanceObj, objects, hosts, currentHostname, adminInstance) {
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
            }
            else {
                console.warn(`Cannot find suitable IP in host ${instanceObj.common.host} for ${instanceObj._id}`);
                return null;
            }
        }
        else {
            console.warn(`Cannot find host ${instanceObj.common.host} for ${instanceObj._id}`);
            return null;
        }
    }
    else {
        hostname = currentHostname;
    }
    return hostname;
}
// internal use
function _replaceLink(link, objects, adapterInstance, attr, placeholder, hosts, hostname, adminInstance) {
    if (attr === 'protocol') {
        attr = 'secure';
    }
    try {
        const object = objects[`system.adapter.${adapterInstance}`];
        if (link && object) {
            if (attr === 'secure') {
                link = link.replace(`%${placeholder}%`, object.native[attr] ? 'https' : 'http');
            }
            else {
                let value = object.native[attr];
                // workaround for port
                if ((attr === 'webinterfacePort' || attr === 'port') && (!value || value === '0')) {
                    if (object.native.secure === true) {
                        value = 443;
                    }
                    else {
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
                    }
                    else {
                        link = link.replace(`%${placeholder}%`, ip || '');
                    }
                }
                else if (!link.includes(`%${placeholder}%`)) {
                    link = link.replace(`%native_${placeholder}%`, value);
                }
                else {
                    link = link.replace(`%${placeholder}%`, value);
                }
            }
        }
        else {
            console.log(`Cannot get link ${attr}`);
            link = link.replace(`%${placeholder}%`, '');
        }
    }
    catch (error) {
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
function replaceLink(link, adapter, instance, context) {
    const _urls = [];
    let port;
    if (link) {
        const instanceObj = context.instances[`system.adapter.${adapter}.${instance}`];
        const native = instanceObj?.native || {};
        const placeholders = link.match(/%(\w+)%/g);
        if (placeholders) {
            for (let p = 0; p < placeholders.length; p++) {
                let placeholder = placeholders[p];
                if (placeholder === '%ip%') {
                    let ip = (native.bind || native.ip);
                    if (!ip || ip === '0.0.0.0') {
                        // Check host
                        ip = getHostname(instanceObj, context.instances, context.hosts, context.hostname, context.adminInstance);
                    }
                    if (_urls.length) {
                        _urls.forEach(item => (item.url = item.url.replace('%ip%', ip || '')));
                    }
                    else {
                        link = link.replace('%ip%', ip || '');
                    }
                }
                else if (placeholder === '%protocol%') {
                    const protocolVal = native.secure === undefined ? native.protocol : native.secure;
                    let protocol;
                    if (protocolVal === true || protocolVal === 'true') {
                        protocol = 'https';
                    }
                    else if (protocolVal === false || protocolVal === 'false' || !protocolVal) {
                        protocol = 'http';
                    }
                    else {
                        protocol = protocolVal.toString().replace(/:$/, '');
                    }
                    if (_urls.length) {
                        _urls.forEach(item => (item.url = item.url.replace('%protocol%', protocol)));
                    }
                    else {
                        link = link.replace('%protocol%', protocol);
                    }
                }
                else if (placeholder === '%s%') {
                    const protocolVal = native.secure === undefined ? native.protocol : native.secure;
                    let protocol;
                    if (protocolVal === true || protocolVal === 'true') {
                        protocol = 's';
                    }
                    else if (protocolVal === false || protocolVal === 'false' || !protocolVal) {
                        protocol = '';
                    }
                    else {
                        protocol = protocolVal.toString().replace(/:$/, '');
                    }
                    if (_urls.length) {
                        _urls.forEach(item => (item.url = item.url.replace('%s%', protocol)));
                    }
                    else {
                        link = link.replace('%s%', protocol);
                    }
                }
                else if (placeholder === '%instance%') {
                    link = link.replace('%instance%', instance.toString());
                    if (_urls.length) {
                        _urls.forEach(item => (item.url = item.url.replace('%instance%', instance.toString())));
                    }
                    else {
                        link = link.replace('%instance%', instance.toString());
                    }
                }
                else {
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
                            _urls.forEach(item => (item.url = _replaceLink(item.url, context.instances, adapterInstance, placeholder, placeholder, context.hosts, context.hostname, context.adminInstance)));
                        }
                        else {
                            link = _replaceLink(link, context.instances, adapterInstance, placeholder, placeholder, context.hosts, context.hostname, context.adminInstance);
                            port = context.instances[`system.adapter.${adapterInstance}`]?.native?.port;
                        }
                    }
                    else {
                        const [adapterInstance, attr] = placeholder.split('_');
                        // if instance number not found
                        if (!adapterInstance.match(/\.[0-9]+$/)) {
                            // list all possible instances
                            let ids;
                            if (adapter === adapterInstance) {
                                // take only this one instance and that's all
                                ids = [`${adapter}.${instance}`];
                            }
                            else {
                                ids = Object.keys(context.instances)
                                    .filter(id => id.startsWith(`system.adapter.${adapterInstance}.`) &&
                                    context.instances[id].common.enabled)
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
                                        item.url = _replaceLink(item.url, context.instances, id, attr, placeholder, context.hosts, context.hostname, context.adminInstance);
                                    }
                                    else {
                                        // add new
                                        const _link = _replaceLink(link, context.instances, id, attr, placeholder, context.hosts, context.hostname, context.adminInstance);
                                        const _port = context.instances[`system.adapter.${id}`]?.native
                                            ?.port;
                                        _urls.push({ url: _link, port: _port, instance: id });
                                    }
                                }
                                else {
                                    const _link = _replaceLink(link, context.instances, id, attr, placeholder, context.hosts, context.hostname, context.adminInstance);
                                    const _port = context.instances[`system.adapter.${id}`]?.native
                                        ?.port;
                                    _urls.push({ url: _link, port: _port, instance: id });
                                }
                            }
                        }
                        else {
                            link = _replaceLink(link, context.instances, adapterInstance, attr, placeholder, context.hosts, context.hostname, context.adminInstance);
                            port = context.instances[`system.adapter.${adapterInstance}`]?.native?.port;
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
/**
 * Checks for a control character
 *
 * Browsers remove tab, newline and carriage return from a URL before they parse it, so a target
 * like `/<TAB>/example.com` would turn into the protocol relative `//example.com` and leave this
 * server. Written without a regular expression to keep the `no-control-regex` rule happy.
 *
 * @param str string to check
 */
function hasControlCharacter(str) {
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
function getRequestedPage(req) {
    const origin = req.body?.origin;
    let href = null;
    if (origin) {
        const q = origin.indexOf('?');
        if (q !== -1) {
            href = new URLSearchParams(origin.substring(q + 1)).get('href');
        }
    }
    else if (typeof req.query?.href === 'string') {
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
function getRedirectPage(req) {
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
function getLoginPageWithError(loginPage, req) {
    return `${loginPage}?href=${encodeURIComponent(getRequestedPage(req) || '/')}&error`;
}
/** Keeps the bytes a parser read, which readBodyAsync() needs: parsed, an empty JSON body is `{}` */
function keepRawBody(req, _res, buf) {
    req.rawBody = buf;
}
/** The parsers for form, JSON and text posts that the login and the other authentication routes need */
function bodyParsers() {
    return [
        body_parser_1.default.urlencoded({ extended: true, verify: keepRawBody }),
        body_parser_1.default.json({ verify: keepRawBody }),
        body_parser_1.default.text({ verify: keepRawBody }),
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
async function readBodyAsync(req, options) {
    if (req.rawBody) {
        return req.rawBody;
    }
    if (req.readableEnded) {
        // Read by some other parser, an extension's for instance, that kept nothing but the result
        const body = req.body;
        if (body === undefined || body === null) {
            return node_buffer_1.Buffer.alloc(0);
        }
        if (node_buffer_1.Buffer.isBuffer(body)) {
            return body;
        }
        return node_buffer_1.Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    }
    const limit = options?.limit ?? 1_000_000;
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
        const buf = node_buffer_1.Buffer.isBuffer(chunk) ? chunk : node_buffer_1.Buffer.from(chunk);
        length += buf.length;
        if (length > limit) {
            const err = new Error('Payload Too Large');
            err.code = 'PAYLOAD_TOO_LARGE';
            throw err;
        }
        chunks.push(buf);
    }
    return node_buffer_1.Buffer.concat(chunks);
}
/**
 * Vite names every chunk `<name>-<hash>.<ext>` below `assets/`, and the hash changes with the content. A name like
 * `material-icons-outlined.woff2` has the same shape, so the hash must also hold a digit or an upper-case letter: a
 * real hash without one only loses the long caching, a wrong match would pin a file that changes with the next update.
 */
const HASHED_ASSET = /(^|\/)assets\/[^/]+-(?=[\w-]*[0-9A-Z])[\w-]{8}\.[a-z0-9]+$/;
/**
 * Cache-Control for a file of the web root.
 *
 * A chunk with a content hash in its name never changes, so the browser keeps it for a year without asking again.
 * Everything else - the HTML pages, but also `config.js`, `remoteEntry.js` or `mf-manifest.json`, which name the chunks
 * of the current version - is asked for on every load and answered with 304 while it is unchanged. So a page loads
 * from the cache, and a new version of an adapter is visible at once.
 *
 * @param id namespace of the file, e.g. `vis-2` or `vis-2.0`
 * @param url path of the file inside the namespace
 */
function getCacheControl(id, url) {
    // Only the files an adapter uploads from its build; the ones of an instance (`vis-2.0`) are user data
    if (!/\.\d+$/.test(id) && HASHED_ASSET.test(url)) {
        return 'public, max-age=31536000, immutable';
    }
    return 'no-cache';
}
//# sourceMappingURL=utils.js.map