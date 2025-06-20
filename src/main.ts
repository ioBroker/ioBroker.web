import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

import session from 'express-session';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { lookup } from 'mime-types';
import compression from 'compression';
import signature from 'cookie-signature';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import flash from 'connect-flash';

import { Adapter, EXIT_CODES, commonTools, type AdapterOptions } from '@iobroker/adapter-core'; // Get common adapter utils
import type { IOSocketClass } from 'iobroker.ws';
import type { SocketSettings, Store, InternalStorageToken } from '@iobroker/socket-classes';
import { WebServer, checkPublicIP, createOAuth2Server } from '@iobroker/webserver';

import type { ExtAPI, LocalLinkEntry, LocalMultipleLinkEntry, WebAdapterConfig } from './types.d.ts';
import { Buffer } from 'buffer';
import { replaceLink } from './lib/utils';

const ONE_MONTH_SEC = 30 * 24 * 3600;
export type Server = HttpServer | HttpsServer;

const LOGIN_PAGE = '/login/index.html';
const wwwDir = '../www';
const FORBIDDEN_CHARS = /[\][*,;'"`<>\\\s?]/g; // with space

// copied from here: https://github.com/component/escape-html/blob/master/index.js
const matchHtmlRegExp = /["'&<>]/;
function escapeHtml(str: string): string {
    const _str = `${str}`;
    const match = matchHtmlRegExp.exec(_str);

    if (!match) {
        return _str;
    }

    let escape;
    let html = '';
    let index;
    let lastIndex = 0;

    for (index = match.index; index < _str.length; index++) {
        switch (_str.charCodeAt(index)) {
            case 34: // "
                escape = '&quot;';
                break;
            case 38: // &
                escape = '&amp;';
                break;
            case 39: // '
                escape = '&#39;';
                break;
            case 60: // <
                escape = '&lt;';
                break;
            case 62: // >
                escape = '&gt;';
                break;
            default:
                continue;
        }

        if (lastIndex !== index) {
            html += _str.substring(lastIndex, index);
        }

        lastIndex = index + 1;
        html += escape;
    }

    return lastIndex !== index ? html + _str.substring(lastIndex, index) : html;
}

function getLinkVar(placeHolder: string, obj: ioBroker.InstanceObject | undefined, attr: string, link: string): string {
    if (attr === 'protocol') {
        attr = 'secure';
    }

    if (placeHolder === 'ip') {
        link = link.replace(`%${placeHolder}%`, '$host$');
    } else if (placeHolder === 'instance') {
        const instance = obj?._id.split('.').pop() || '';
        link = link.replace(`%${placeHolder}%`, instance);
    } else if (obj) {
        // remove "native_" from e.g. "native_port"
        if (attr.startsWith('native_')) {
            attr = attr.substring(7);
        }

        let val: string | number | boolean | undefined = obj.native[attr];
        if (placeHolder === 'bind' && (!val || val === '0.0.0.0')) {
            val = '$host$';
        }

        if (attr === 'secure') {
            link = link.replace(`%${placeHolder}%`, val ? 'https' : 'http');
        } else {
            if (!link.includes(`%${placeHolder}%`)) {
                link = link.replace(`%native_${placeHolder}%`, val === 0 ? '0' : val?.toString() || '');
            } else {
                link = link.replace(`%${placeHolder}%`, val === 0 ? '0' : val?.toString() || '');
            }
        }
    } else {
        // No instance object => set empty values
        if (attr === 'secure') {
            link = link.replace(`%${placeHolder}%`, 'http');
        } else {
            if (!link.includes(`%${placeHolder}%`)) {
                link = link.replace(`%native_${placeHolder}%`, '');
            } else {
                link = link.replace(`%${placeHolder}%`, '');
            }
        }
    }

    return link;
}

function processOneWelcome(
    welcomeScreen: ioBroker.WelcomeScreenEntry,
    isPro: boolean,
    adapterObj: ioBroker.AdapterObject,
    foundInstanceIDs: `system.adapter.${string}.${number}`[],
    instances: Record<`system.adapter.${string}.${number}`, ioBroker.InstanceObject>,
    hosts: Record<`system.host.${string}`, ioBroker.HostObject>,
    hostname: string,
    webNamespace: string,
    list: LocalMultipleLinkEntry[],
): void {
    let ws: {
        link: string;
        localLinks?: string | string[];
        localLink?: string | string[];
        name: string;
        img: string;
        color: string;
        order?: number;
    };

    if (typeof welcomeScreen === 'string') {
        ws = {
            link: welcomeScreen,
            name: adapterObj.common.name,
            color: adapterObj.common.color || '',
            img: adapterObj.common.icon || '',
        };
    } else {
        ws = welcomeScreen;
    }

    // disabled for non-pro
    if (!isPro && ws.name === 'vis editor') {
        return;
    }

    let localLink: string;
    // If we have localLinks=['_default']
    if (ws.localLinks && typeof ws.localLinks === 'string') {
        if (adapterObj.common.localLinks && typeof adapterObj.common.localLinks[ws.localLinks] === 'object') {
            localLink = adapterObj.common.localLinks[ws.localLinks].link as string;
        } else {
            localLink = ws.localLinks;
        }
    } else if (ws.localLink?.toString() === 'true') {
        if (adapterObj.common.localLink) {
            localLink = adapterObj.common.localLink;
        } else if (typeof adapterObj.common.localLinks?._default === 'string') {
            localLink = adapterObj.common.localLinks._default;
        } else if (typeof adapterObj.common.localLinks?._default === 'object') {
            localLink = adapterObj.common.localLinks._default.link;
        } else {
            localLink = '';
        }
    } else if (ws.localLink) {
        // localLink = '%protocol%://%bind%:%port%'
        localLink = (ws.localLink as string) || '';
    } else {
        // link = '%protocol%://%bind%:%port%'
        localLink = ws.link;
    }
    let hrefs: {
        url: string;
        port: number | undefined;
        instance?: string;
    }[] = [];

    // Replace in localLink the patterns
    if (adapterObj.type === 'adapter') {
        foundInstanceIDs.forEach((id: string): void => {
            const instance = parseInt(id.split('.').pop() || '0', 10);
            const _hrefs = replaceLink(localLink, adapterObj.common.name, instance, {
                hostname,
                // it cannot be void
                instances,
                hosts,
                adminInstance: webNamespace,
            });
            _hrefs.forEach(item => (item.instance = instance.toString()));
            hrefs.push(..._hrefs);
        });
    } else {
        const instance = parseInt(adapterObj._id.split('.').pop() || '0', 10);
        hrefs = replaceLink(localLink, adapterObj.common.name, parseInt(adapterObj._id.split('.').pop() || '0', 10), {
            hostname,
            // it cannot be void
            instances,
            hosts,
            adminInstance: webNamespace,
        });
        hrefs.forEach(item => (item.instance = instance.toString()));
    }
    hrefs.forEach(item => (item.url = item.url.replace(`//${hostname}:`, '//$host$:')));

    hrefs.forEach(item => {
        list.push({
            name: ws.name,
            img: ws.img,
            link: ws.link.includes('%') ? item.url : ws.link,
            localLink: item.url,
            color: ws.color,
            order: ws.order,
            pro: isPro,
            id: `system.adapter.${adapterObj.common.name}.${item.instance ? parseInt(item.instance, 10) || 0 : 0}`,
            instance: item.instance ? parseInt(item.instance, 10) || 0 : 0,
        });
    });
}

function processWelcome(
    welcomeScreen: ioBroker.WelcomeScreenEntry | ioBroker.WelcomeScreenEntry[] | undefined,
    isPro: boolean,
    adapterObj: ioBroker.AdapterObject,
    foundInstanceIDs: `system.adapter.${string}.${number}`[],
    instances: Record<`system.adapter.${string}.${number}`, ioBroker.InstanceObject>,
    hosts: Record<`system.host.${string}`, ioBroker.HostObject>,
    hostname: string,
    webNamespace: string,
    list: LocalMultipleLinkEntry[],
): void {
    if (welcomeScreen) {
        if (Array.isArray(welcomeScreen)) {
            for (let w = 0; w < welcomeScreen.length; w++) {
                let ws: ioBroker.WelcomeScreenEntry;
                if (typeof welcomeScreen[w] === 'string') {
                    ws = {
                        link: welcomeScreen[w] as string,
                        name: adapterObj.common.name,
                        color: adapterObj.common.color || '',
                        img: adapterObj.common.icon || '',
                    };
                } else {
                    ws = welcomeScreen[w];
                }
                processOneWelcome(
                    ws,
                    isPro,
                    adapterObj,
                    foundInstanceIDs,
                    instances,
                    hosts,
                    hostname,
                    webNamespace,
                    list,
                );
            }
        } else {
            let ws: ioBroker.WelcomeScreenEntry;
            if (typeof welcomeScreen === 'string') {
                ws = {
                    link: welcomeScreen,
                    name: adapterObj.common.name,
                    color: adapterObj.common.color || '',
                    img: adapterObj.common.icon || '',
                };
            } else {
                ws = welcomeScreen;
            }
            processOneWelcome(ws, isPro, adapterObj, foundInstanceIDs, instances, hosts, hostname, webNamespace, list);
        }
    }
}

function getRedirectPage(req: Request): string {
    let redirect = '../';
    let parts;
    const body: { origin?: string } = req.body || {};
    // const isDev = req.url.includes('?dev&');

    const origin = body.origin || '?href=%2F';

    if (origin) {
        parts = origin.split('=');
        if (parts.length > 1 && parts[1]) {
            redirect = decodeURIComponent(parts[1]);
            // if some invalid characters in redirect
            if (redirect.match(/[^-_a-zA-Z0-9&%?./]/)) {
                redirect = '../';
            }
        }
    }

    return redirect;
}

function extractPreSetting(obj: Record<string, any>, attr: string): string | number | boolean | null {
    const parts = attr.split('.');
    if (parts.length === 1) {
        if ((obj && typeof obj === 'object') || (obj !== null && obj !== undefined)) {
            return obj[attr];
        }

        return null;
    }

    attr = parts.shift() || '';
    if (obj[attr] && typeof obj[attr] === 'object') {
        return extractPreSetting(obj[attr], parts.join('.'));
    }

    return null;
}

interface WebStructure {
    server: null | (Server & { __server: WebStructure });
    io: null | IOSocketClass;
    app: Express | null;
}

export class WebAdapter extends Adapter {
    declare public config: WebAdapterConfig;

    private indexHtml = '';
    private checkTimeout: ioBroker.Timeout | undefined;
    private vendorPrefix = '';

    private webServer: WebStructure = {
        server: null,
        io: null,
        app: null,
    };
    private store: Store | null = null;
    private secret = 'Zgfr56gFe87jJOM'; // Will be generated by first start
    private socketUrl = '';
    private readonly cache: { [fileName: string]: { mimeType: string; buffer: Buffer<ArrayBuffer> } } = {}; // cached web files
    private ownSocket = false;
    /** If socket instance is alive */
    private socketioAlive = false;
    private lang: ioBroker.Languages = 'en';
    private readonly extensions: Record<string, { path: string; config: ioBroker.InstanceObject; obj?: ExtAPI }> = {};
    private readonly bruteForce: { [userName: string]: { errors: number; time: number } } = {};
    private socketIoFile: Buffer | false = false;
    private readonly webPreSettings: Record<
        `system.adapter.${string}.${number}`,
        Record<string, number | boolean | string | null>
    > = {};
    private readonly webByVersion: { [instance: string]: string } = {};
    private loginPage: string | null = null;
    private ownGroups: Record<`system.group.${string}`, ioBroker.GroupObject> | null = null;
    private ownUsers: Record<`system.user.${string}`, ioBroker.UserObject> | null = null;

    private templateDir: string = '';
    private template404: string = '';
    private I18n: {
        translate: (text: string, ...args: string[]) => string;
        init: (rootDir: string, languageOrAdapter: ioBroker.Adapter | ioBroker.Languages) => Promise<void>;
    } | null = null;

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({
            ...options,
            name: 'web',
            unload: callback => this.onUnload(callback),
            message: obj => this.onMessage(obj),
            stateChange: (id: string, state: ioBroker.State | null | undefined) => this.onStateChange(id, state),
            ready: () => this.onReady(),
            objectChange: (id: string, obj: ioBroker.Object | null | undefined): void => this.onObjectChange(id, obj),
            fileChange: (id: string, fileName: string, size: number | null): void =>
                this.onFileChange(id, fileName, size),
        });

        void import('@iobroker/i18n').then(i18n => (this.I18n = i18n));
    }

    onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
        if (this.ownGroups && id.startsWith('system.group.')) {
            if (obj) {
                this.ownGroups[id as `system.group.${string}`] = obj as ioBroker.GroupObject;
            } else {
                delete this.ownGroups[id as `system.group.${string}`];
            }
        }
        if (this.ownUsers && id.startsWith('system.user.')) {
            if (obj) {
                this.ownUsers[id as `system.user.${string}`] = obj as ioBroker.UserObject;
            } else {
                delete this.ownUsers[id as `system.user.${string}`];
            }
        }

        if (id.startsWith('system.adapter')) {
            if (
                obj?.common?.webExtension &&
                obj.native &&
                (this.extensions[id.substring('system.adapter.'.length)] ||
                    obj.native.webInstance === '*' ||
                    obj.native.webInstance === this.namespace)
            ) {
                return this.setForeignState(`system.adapter.${this.namespace}.alive`, false, true, () =>
                    this.terminate ? this.terminate(-100) : process.exit(-100),
                );
            }

            // 'system.adapter.'.length = 15
            const _id = id.substring(15).replace(/\.\d+$/, '');
            if (obj?.common?.webByVersion) {
                this.webByVersion[_id] = obj.common.version;
            } else if (this.webByVersion[_id]) {
                delete this.webByVersion[_id];
            }
        }

        if (obj?.common?.webPreSettings && obj.type === 'instance') {
            this.updatePreSettings(obj as ioBroker.InstanceObject);
        }

        if (!this.ownSocket && id === this.config.socketio) {
            void this.getSocketUrl(obj as ioBroker.InstanceObject).then(() => {
                this.log.info(`SocketURL now "${this.socketUrl}"`);
            });
        }

        // If system language desired => update language
        if (id === 'system.config' && !this.config.language) {
            this.lang = obj?.common?.language || 'en';
        }

        if (this.webServer?.io) {
            try {
                this.webServer.io.publishAll('objectChange', id, obj);
            } catch (e) {
                this.log.error(`Cannot objectChange to io: ${e}`);
            }
        }

        // inform extensions
        Object.keys(this.extensions).forEach(instance => {
            try {
                if (typeof this.extensions[instance].obj?.objectChange === 'function') {
                    this.extensions[instance].obj.objectChange(id, obj);
                }
            } catch (err) {
                this.log.error(`Cannot call objectChange for "${instance}": ${err.message}`);
            }
        });
    }

    onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        this.webServer?.io?.publishAll('stateChange', id, state);

        if (!this.ownSocket && id === `${this.config.socketio}.alive`) {
            if (this.socketioAlive !== !!state?.val) {
                this.socketioAlive = !!state?.val;
                void this.getSocketUrl(undefined, state).then(() => {
                    this.log.info(`SocketURL now "${this.socketUrl}"`);
                });
            }
        }

        // inform extensions
        Object.keys(this.extensions).forEach(instance => {
            try {
                if (typeof this.extensions[instance].obj?.stateChange === 'function') {
                    this.extensions[instance].obj.stateChange(id, state);
                }
            } catch (err) {
                this.log.error(`Cannot call stateChange for "${instance}": ${err.message}`);
            }
        });
    }

    onFileChange(id: string, fileName: string, size: number | null): void {
        this.webServer?.io?.publishFileAll(id, fileName, size);

        // inform extensions
        Object.keys(this.extensions).forEach(instance => {
            try {
                if (typeof this.extensions[instance].obj?.fileChange === 'function') {
                    this.extensions[instance].obj.fileChange(id, fileName, size);
                }
            } catch (err) {
                this.log.error(`Cannot call fileChange for "${instance}": ${err.message}`);
            }
        });
    }

    onMessage(msg: ioBroker.Message): void {
        if (msg?.command === 'getUserByCookie') {
            let cookie: string | false = (msg.message?.cookie || '').toString();

            // extract cookie
            if (cookie && cookie.includes('connect.sid=')) {
                const cookies = cookie.split(';');
                const connectSid = cookies.find(cookie => cookie.trim().startsWith('connect.sid='));
                cookie = (connectSid || '').replace('connect.sid=', '').trim();
            }

            // decrypt cookie
            if (cookie) {
                try {
                    cookie = signature.unsign(decodeURIComponent(cookie).slice(2), this.secret);
                } catch (e) {
                    this.log.warn(`Cannot decrypt cookie: ${e}`);
                }
            }

            // get session by cookie
            if (this.store && cookie && msg.callback) {
                this.store.get(
                    cookie,
                    (
                        error: Error | null,
                        session?: {
                            cookie: {
                                originalMaxAge: number;
                                expires: string;
                                httpOnly: boolean;
                                path: string;
                            };
                            passport: {
                                user: string;
                            };
                        },
                    ): void => {
                        this.sendTo(msg.from, msg.command, { error, user: session?.passport?.user }, msg.callback);
                    },
                );
            } else if (msg.callback) {
                this.sendTo(msg.from, msg.command, { error: 'cookie not found' }, msg.callback);
            }
        } else if (msg?.command === 'im') {
            // if not instance message
            if (this.webServer?.io) {
                // to make messages shorter, we code the answer as:
                // m - message type
                // s - socket ID
                // d - data

                this.webServer.io.publishInstanceMessageAll(msg.from, msg.message.m, msg.message.s, msg.message.d);
            }
        }
    }

    onUnload(callback: () => void): void {
        if (this.checkTimeout) {
            this.clearTimeout(this.checkTimeout);
            this.checkTimeout = null;
        }

        try {
            const promises: Promise<void | string>[] = [];

            if (this.setStateAsync) {
                promises.push(this.setStateAsync('info.connected', '', true));
                promises.push(this.setStateAsync('info.connection', false, true));
            }

            Object.keys(this.extensions).forEach(instance => {
                try {
                    if (this.extensions?.[instance]?.obj?.unload) {
                        const promise = this.extensions[instance].obj.unload();
                        if (promise instanceof Promise) {
                            promises.push(
                                promise.catch(e => this?.log?.error(`Cannot unload web extension "${instance}": ${e}`)),
                            );
                        }
                    }
                } catch (e) {
                    this?.log?.error(`Cannot unload web extension "${instance}": ${e}`);
                }
            });

            let timeout: ioBroker.Timeout | undefined;
            if (promises.length) {
                timeout = this.setTimeout(() => {
                    timeout = undefined;
                    this?.log?.warn(`Timeout by termination of web-extensions!`);
                    this?.log?.debug(
                        `terminating http${this.config.secure ? 's' : ''} server on port ${this.config.port}`,
                    );
                    this.webServer?.io?.close();
                    this.webServer?.server?.close();
                    this?.log?.info(
                        `terminated http${this.config.secure ? 's' : ''} server on port ${this.config.port}`,
                    );
                    if (callback) {
                        callback();
                    }
                }, 500);
            }

            void Promise.all(promises)
                .catch(e => this?.log?.error(`Cannot unload web extensions: ${e}`))
                .then(() => {
                    if (!promises.length || timeout) {
                        this.clearTimeout(timeout);
                        timeout = null;
                        this?.log?.debug(
                            `terminating http${this.config.secure ? 's' : ''} server on port ${this.config.port}`,
                        );
                        this.webServer?.io?.close();
                        this.webServer?.server?.close();
                        this?.log?.info(
                            `terminated http${this.config.secure ? 's' : ''} server on port ${this.config.port}`,
                        );
                        if (callback) {
                            callback();
                        }
                    }
                });
        } catch {
            if (callback) {
                callback();
            }
        }
    }

    async onReady(): Promise<void> {
        // Generate secret for session manager
        const systemConfig = await this.getForeignObjectAsync('system.config');

        if (systemConfig) {
            if (!systemConfig?.native?.secret) {
                systemConfig.native = systemConfig.native || {};
                const buf: Buffer = await new Promise<Buffer>(resolve =>
                    require('crypto').randomBytes(24, (_err: Error | null, buf: Buffer): void => resolve(buf)),
                );
                this.secret = buf.toString('hex');
                await this.extendForeignObjectAsync('system.config', { native: { secret: this.secret } });
            } else {
                this.secret = systemConfig.native.secret;
            }
        } else {
            this.log.error('Cannot find object system.config');
        }

        let uuid: null | ioBroker.MetaObject | undefined = null;
        try {
            uuid = await this.getForeignObjectAsync('system.meta.uuid');
        } catch (e) {
            this.log.warn(`Cannot read UUID: ${e}`);
        }
        this.vendorPrefix =
            (systemConfig?.native?.vendor?.uuidPrefix as string) ||
            (uuid?.native?.uuid?.length > 36 ? uuid!.native.uuid.substring(0, 2) : '');

        // information about connected socket.io adapter
        if (this.config.socketio?.startsWith('system.adapter.')) {
            await this.getSocketUrl();
            // Listen for changes
            await this.subscribeForeignObjectsAsync(this.config.socketio);
            await this.subscribeForeignStatesAsync(`${this.config.socketio}.alive`);
        } else {
            this.socketUrl = this.config.socketio;
            this.ownSocket = this.socketUrl !== 'none';
        }

        // Read language
        if (this.config.language) {
            this.lang = this.config.language;
        } else if (systemConfig?.common) {
            this.lang = systemConfig.common.language || 'en';
        }

        await this.I18n?.init(__dirname, this.lang);

        await this.main();
    }

    updatePreSettings(obj: ioBroker.InstanceObject): void {
        if (!obj?.common) {
            return;
        }
        if (obj.common.webPreSettings) {
            for (const attr in obj.common.webPreSettings) {
                this.webPreSettings[obj._id] ||= {};
                const _attr = attr.replace(/[^\w0-9]/g, '_');
                this.webPreSettings[obj._id][_attr] = extractPreSetting(obj, obj.common.webPreSettings[attr]);
                if (typeof this.webPreSettings[obj._id][_attr] === 'object') {
                    this.webPreSettings[obj._id][_attr] = JSON.stringify(this.webPreSettings[obj._id][_attr]);
                } else {
                    const val = this.webPreSettings[obj._id][_attr];
                    if (typeof val === 'string') {
                        this.webPreSettings[obj._id][_attr] = val.replace(/"/g, '\\"');
                    } else {
                        this.webPreSettings[obj._id][_attr] = val;
                    }
                }
            }
        } else if (this.webPreSettings[obj._id]) {
            delete this.webPreSettings[obj._id];
        }
    }

    async getExtensionsAndSettings(): Promise<ioBroker.InstanceObject[]> {
        const doc = await this.getObjectViewAsync('system', 'instance', null);
        if (!doc.rows?.length) {
            return [];
        }
        const res = [];
        for (let i = 0; i < doc.rows.length; i++) {
            const instance = doc.rows[i].value;
            if (instance?.common) {
                if (!this.config.startDisabledExtensions && !instance.common.enabled) {
                    const alive = await this.getForeignStateAsync(`${instance._id}.alive`);
                    if (alive?.val) {
                        // simulate as it is enabled
                        instance.common.enabled = true;
                    }
                }

                if (
                    (this.config.startDisabledExtensions || instance.common.enabled) &&
                    instance.common.webExtension &&
                    (instance.native.webInstance === this.namespace || instance.native.webInstance === '*')
                ) {
                    // decrypt all native attributes listed in instance.encryptedNative
                    if (Array.isArray(instance.encryptedNative) && instance.native) {
                        instance.encryptedNative.forEach(key => {
                            if (instance.native[key]) {
                                instance.native[key] = this.decrypt(this.secret, instance.native[key]);
                            }
                        });
                    }

                    res.push(instance);
                }
                if (instance.common.webPreSettings) {
                    this.updatePreSettings(instance);
                }
                if (instance.common.webByVersion) {
                    // 'system.adapter.'.length = 15
                    const _id = doc.rows[i].value._id.substring(15).replace(/\.\d+$/, '');
                    this.webByVersion[_id] = instance.common.version;
                }
            }
        }

        return res;
    }

    async getListOfAllAdapters(remoteIp: string): Promise<{
        systemLang: ioBroker.Languages;
        showAdminInstances: boolean;
        authEnabled: boolean;
        list: LocalMultipleLinkEntry[];
    }> {
        const config: {
            systemLang: ioBroker.Languages;
            showAdminInstances: boolean;
            authEnabled: boolean;
            list: LocalMultipleLinkEntry[];
        } = {} as {
            systemLang: ioBroker.Languages;
            showAdminInstances: boolean;
            authEnabled: boolean;
            list: LocalMultipleLinkEntry[];
        };
        // read all instances
        const instances = await this.getObjectViewAsync('system', 'instance', {});
        const adapters = await this.getObjectViewAsync('system', 'adapter', {});
        const hosts = await this.getObjectViewAsync('system', 'host', {});
        const webConfig = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
        // The list will be filled up in processOneWelcome
        const list: LocalMultipleLinkEntry[] = [];
        const mapHosts: Record<`system.host.${string}`, ioBroker.HostObject> = {};
        for (let h = 0; h < hosts.rows.length; h++) {
            mapHosts[hosts.rows[h].id] = hosts.rows[h].value;
        }
        const mapInstances: Record<`system.adapter.${string}.${number}`, ioBroker.InstanceObject> = {};
        for (let r = 0; r < instances.rows.length; r++) {
            mapInstances[instances.rows[r].id] = instances.rows[r].value;
        }

        for (let a = 0; a < adapters.rows.length; a++) {
            const obj: ioBroker.AdapterObject = adapters.rows[a].value;
            let found: `system.adapter.${string}.${number}`[] | undefined;
            if (instances?.rows) {
                found = [];
                // find if any instance of this adapter exists and started
                for (let i = 0; i < instances.rows.length; i++) {
                    // remove number from instance
                    const id: string = instances.rows[i].id.replace(/\.\d+$/, '');
                    if (
                        id === obj._id &&
                        instances.rows[i].value.common
                        // && (true || instances.rows[i].value.common.enabled || instances.rows[i].value.common.onlyWWW)
                    ) {
                        found.push(instances.rows[i].id);
                    }
                }
            }

            if (found?.length) {
                // Add from localLinks
                if (obj.common.localLinks && typeof obj.common.localLinks === 'object') {
                    for (const link in obj.common.localLinks) {
                        if (typeof obj.common.localLinks[link] === 'object') {
                            let name: ioBroker.StringOrTranslated = obj.common.localLinks[link].name || obj.common.name;
                            if (typeof name === 'object') {
                                name = name[this.lang] || name.en;
                            }
                            processOneWelcome(
                                {
                                    name,
                                    link: obj.common.localLinks[link].link,
                                    img: obj.common.localLinks[link].icon || obj.common.icon || '',
                                    color: obj.common.localLinks[link].color || obj.common.color || '',
                                    // @ts-expect-error fixed in js-controller
                                    order: obj.common.localLinks[link].order,
                                },
                                !!obj.common.localLinks[link].pro,
                                obj,
                                found,
                                mapInstances,
                                mapHosts,
                                this.host!,
                                this.namespace,
                                list as LocalLinkEntry[],
                            );
                        }
                    }
                }

                try {
                    processWelcome(
                        obj.common.welcomeScreen,
                        false,
                        obj,
                        found,
                        mapInstances,
                        mapHosts,
                        this.host!,
                        this.namespace,
                        list,
                    );
                    processWelcome(
                        obj.common.welcomeScreenPro,
                        true,
                        obj,
                        found,
                        mapInstances,
                        mapHosts,
                        this.host!,
                        this.namespace,
                        list,
                    );
                } catch (e) {
                    this.log.warn(`Cannot process welcome screen for "${obj._id}": ${e}`);
                }
            }
        }
        const sameHost = `${webConfig!.native.secure ? 'https' : 'http'}://$host$`;
        const sameServer = `${webConfig!.native.secure ? 'https' : 'http'}://$host$:${webConfig!.native.port}/`;

        list.forEach(item => {
            item.link = item.link.replace(sameServer, '').replace(sameHost, '');
            item.localLink = item.link.replace(sameServer, '').replace(sameHost, '');
            if (item.name === 'Admin') {
                item.link = 'admin/index.html';
            }
            if (!item.img?.includes('/') && item.id) {
                // Add adapter prefix to the image: image.png => adapter/node-red/image.png
                const parts = item.id.split('.');
                parts.pop();
                item.img = `adapter/${parts.pop()}/${item.img}`;
            }
        });

        // Remove duplicated entries
        const uniqueList = [];
        for (const link of list) {
            let found = false;
            for (const ul of uniqueList) {
                if (ul.localLink === link.localLink && ul.pro === link.pro) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                uniqueList.push(link);
            }
        }

        // Remove admin/index.html from the list
        const adminIndex = uniqueList.findIndex(item => item.localLink === 'admin/index.html');
        if (adminIndex !== -1) {
            uniqueList.splice(adminIndex, 1);
        }

        // calculate localLinks
        for (const listItem of uniqueList) {
            if (typeof listItem.localLink === 'string') {
                listItem.localLink = this.resolveLink(
                    listItem.localLink,
                    listItem.id ? mapInstances[listItem.id] : undefined,
                    mapInstances,
                );
            }

            if (!listItem.name) {
                // @ts-expect-error deprecated, but could happen
                listItem.name = listItem.title;
            }
        }

        // try to find swagger web-extension
        // inform extensions
        Object.keys(this.extensions).forEach(instance => {
            try {
                if (typeof this.extensions[instance]?.obj?.welcomePage === 'function') {
                    uniqueList.push(this.extensions[instance].obj.welcomePage());
                }
            } catch (err) {
                this.log.error(`Cannot call welcomePage for "${instance}": ${err.message}`);
            }
        });

        uniqueList.sort((a, b) => {
            const aName = (
                a.name && typeof a.name === 'object' ? a.name[this.lang] || a.name.en : a.name || ''
            ).toLowerCase();

            const bName = (
                b.name && typeof b.name === 'object' ? b.name[this.lang] || b.name.en : b.name || ''
            ).toLowerCase();

            if (a.order === undefined && b.order === undefined) {
                if (aName > bName) {
                    return 1;
                }
                if (aName < bName) {
                    return -1;
                }
                return 0;
            }
            if (a.order === undefined) {
                return -1;
            }
            if (b.order === undefined) {
                return 1;
            }
            if (a.order > b.order) {
                return 1;
            }
            if (a.order < b.order) {
                return -1;
            }
            if (aName > bName) {
                return 1;
            }
            if (aName < bName) {
                return -1;
            }
            if (a.instance !== undefined && b.instance !== undefined) {
                if (a.instance > b.instance) {
                    return 1;
                }
                if (a.instance < b.instance) {
                    return -1;
                }
            }

            return 0;
        });

        const whiteListIp = this.isInWhiteList(remoteIp);

        config.systemLang = this.lang;
        config.showAdminInstances = !!this.config.showAdminInstances;
        config.authEnabled = this.config.auth && !this.config.basicAuth && !whiteListIp;
        config.list = uniqueList;
        return config;
    }

    async getIndexHtml(req: Request): Promise<string> {
        const config = await this.getListOfAllAdapters(
            (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').toString(),
        );

        const lines = [
            `showAdminInstances = ${config.showAdminInstances};`,
            `systemLang = "${config.systemLang}";`,
            `list = ${JSON.stringify(config.list, null, 2)};`,
            // if login
            `let authEnabled = ${config.authEnabled};`,
        ];

        if (!this.indexHtml && !existsSync(`${__dirname}/${wwwDir}/index.html`)) {
            return `${__dirname}/${wwwDir}/index.html was not found or no access! Check the file or access rights or start the fixer: "curl -sL https://iobroker.net/fix.sh | bash -"`;
        }
        this.indexHtml ||= readFileSync(`${__dirname}/${wwwDir}/index.html`).toString();

        return this.indexHtml.replace('// -- PLACE THE LIST HERE --', lines.join('\n'));
    }

    /**
     * Transform pattern like %protocol%://%web.0_bind%:%port into https://192.168.1.1:8081
     *
     * @param link Pattern
     * @param instanceObj Current instance object
     * @param instancesMap All instances
     */
    resolveLink(
        link: string,
        instanceObj: ioBroker.InstanceObject | undefined,
        instancesMap: Record<string, ioBroker.InstanceObject>,
    ): string | { [instance: `${string}.${number}`]: string } {
        // Extract all patterns
        const vars = link.match(/%(\w+)%/g);
        let result: { [instance: string]: string } | undefined;

        if (vars) {
            // first replace simple patterns
            for (let v = vars.length - 1; v >= 0; v--) {
                // Remove % at start and end
                const _var = vars[v].replace(/%/g, '');

                const [adapterName, variableName] = _var.split('_');
                // like "port"
                if (adapterName === 'native' || variableName === undefined) {
                    link = getLinkVar(_var, instanceObj, _var, link);
                    vars.splice(v, 1);
                } else if (adapterName.match(/\.\d+$/)) {
                    // like "web.0_port"
                    link = getLinkVar(_var, instancesMap[`system.adapter.${adapterName}`], variableName, link);
                    vars.splice(v, 1);
                }
            }

            const links: Record<string, { instance: string; link: string }> = {};
            const instances: { [adapterName: string]: string[] } = {};

            // process web_port, as it could have more than one instance
            for (const placeHolder of vars) {
                const shortPlaceHolder = placeHolder.replace(/%/g, '').replace(/^native_/, '');

                const [adapterName, variableName] = shortPlaceHolder.split('_');

                if (adapterName) {
                    // collect all instances
                    instances[adapterName] ||= Object.values(instancesMap)
                        .map(inst =>
                            inst._id.startsWith(`system.adapter.${adapterName}.`)
                                ? inst._id.replace('system.adapter.', '')
                                : '',
                        )
                        .filter(inst => inst);

                    if (!instances[adapterName].length) {
                        delete instances[adapterName];
                    } else {
                        for (const instance of instances[adapterName]) {
                            links[instance] = {
                                instance,
                                link: getLinkVar(
                                    shortPlaceHolder,
                                    instancesMap[`system.adapter.${instance}`],
                                    variableName,
                                    links[instance]?.link || link,
                                ),
                            };
                        }
                    }
                }
            }
            if (instances) {
                result = {};
                let count = 0;
                let firstLink = '';
                // If we have only one instance, reduce it to string
                Object.values(links).forEach(lnk => {
                    result![lnk.instance] = lnk.link;
                    firstLink = firstLink || lnk.link;
                    count++;
                });
                if (count < 2) {
                    link = firstLink;
                    result = undefined;
                }
            }
        }

        return result || link;
    }

    getInfoJs(): string {
        const result = [
            `var socketUrl = "${this.socketUrl}";`,
            `var socketSession = "";`,
            `window._authIoBroker = ${this.config.auth};`,
            `window.sysLang = "${this.lang}";`,
            `window.socketForceWebSockets = ${this.config.forceWebSockets ? 'true' : 'false'};`,
        ];
        Object.values(this.webPreSettings).forEach(preSetting => {
            if (preSetting) {
                for (const attr in preSetting) {
                    result.push(`window.${attr} = "${preSetting[attr]}";`);
                }
            }
        });

        return result.join(' ');
    }

    checkUser = (
        userName: string | undefined,
        password: string | undefined,
        cb: (err: Error | null, result?: { logged_in: boolean; user?: string }) => void,
    ): void => {
        userName = (userName || '')
            .toString()
            .replace(FORBIDDEN_CHARS, '_')
            .replace(/\s/g, '_')
            .replace(/\./g, '_')
            .toLowerCase();

        if (this.bruteForce[userName] && this.bruteForce[userName].errors > 4) {
            let minutes = Date.now() - this.bruteForce[userName].time;
            if (this.bruteForce[userName].errors < 7) {
                if (Date.now() - this.bruteForce[userName].time < 60000) {
                    minutes = 1;
                } else {
                    minutes = 0;
                }
            } else if (this.bruteForce[userName].errors < 10) {
                if (Date.now() - this.bruteForce[userName].time < 180000) {
                    minutes = Math.ceil((180000 - minutes) / 60000);
                } else {
                    minutes = 0;
                }
            } else if (this.bruteForce[userName].errors < 15) {
                if (Date.now() - this.bruteForce[userName].time < 600000) {
                    minutes = Math.ceil((600000 - minutes) / 60000);
                } else {
                    minutes = 0;
                }
            } else if (Date.now() - this.bruteForce[userName].time < 3600000) {
                minutes = Math.ceil((3600000 - minutes) / 60000);
            } else {
                minutes = 0;
            }

            if (minutes) {
                return cb(
                    new Error(`Too many errors. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`),
                    { logged_in: false },
                );
            }
        }

        void this.checkPassword(userName, password || '', (success: boolean): void => {
            if (!success) {
                this.bruteForce[userName] = this.bruteForce[userName] || { errors: 0 };
                this.bruteForce[userName].time = Date.now();
                this.bruteForce[userName].errors++;
            } else if (this.bruteForce[userName]) {
                delete this.bruteForce[userName];
            }

            if (success) {
                return cb(null, { logged_in: true, user: userName });
            }

            return cb(null, { logged_in: false });
        });
    };

    initAuth(): void {
        if (!this.webServer.app) {
            return;
        }
        const AdapterStore = commonTools.session(session, this.config.ttl);

        this.store = new AdapterStore({ adapter: this });

        passport.use(new LocalStrategy(this.checkUser));

        passport.serializeUser<string>(
            (user: Express.User, done: (err: Error | null | undefined, serializedUser: string) => void): void =>
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                done(null, user.toString()),
        );

        passport.deserializeUser<string>(
            (serializedUser: string, done: (err: Error | null, user: Express.User) => void): void =>
                done(null, serializedUser),
        );

        this.webServer.app.use(cookieParser());
        this.webServer.app.use(bodyParser.urlencoded({ extended: true }));
        this.webServer.app.use(bodyParser.json());
        this.webServer.app.use(bodyParser.text());

        // Install oauth2 server
        createOAuth2Server(this, { app: this.webServer.app, secure: this.config.secure, loginPage: LOGIN_PAGE });

        this.webServer.app.use(
            session({
                secret: this.secret,
                saveUninitialized: true,
                resave: true,
                cookie: { maxAge: (parseInt(this.config.ttl as string, 10) || 3600) * 1000, httpOnly: false }, // default TTL
                // @ts-expect-error missing typing
                store: this.store!,
            }),
        );
        this.webServer.app.use(passport.initialize());
        this.webServer.app.use(passport.session());
        this.webServer.app.use(flash());
    }

    /**
     * Send response to a byte ranges request
     *
     * @param req - request object
     * @param res - response object
     * @param buffer - buffer to be sent
     */
    sendRange(req: Request, res: Response, buffer: Buffer): void {
        const ranges: { start: number; end: number }[] | undefined | number = req.range(buffer.length);

        if (Array.isArray(ranges) && ranges.length > 1) {
            this.log.warn('Multiple ranges currently not supported, sending whole buffer');
            res.status(200).send(buffer);
            return;
        }
        if (!Array.isArray(ranges) || ranges.length === 0) {
            res.set('Content-Length', buffer.length.toString());
            res.status(200).send(buffer);
            return;
        }

        // This is for <video> tag on iOS Safari, only one range is used by Safari, so this is enough for now
        const range = ranges[0] || { start: 0, end: buffer.length };
        res.set('Content-Range', `bytes ${range.start}-${range.end}/${buffer.length}`);

        const buf = buffer.subarray(range.start, range.end + 1);
        res.set('Content-Length', buf.length.toString());
        res.status(206).send(buf);
    }

    getSocketIoFile(req: Request, res: Response, next: NextFunction | true): void {
        if (
            next === true ||
            (req.url || '').endsWith('socket.io.js') ||
            (req.url || '').match(/\/socket\.io\.js(\?.*)?$/)
        ) {
            if (this.socketIoFile) {
                res.contentType('application/javascript');
                res.set('Cache-Control', `public, max-age=${this.config.staticAssetCacheMaxAge}`);
                res.status(200).send(this.socketIoFile);
                return;
            }
            // if used internal socket io, so deliver @iobroker/ws
            if (
                (!this.config.socketio && this.config.usePureWebSockets) ||
                this.config.socketio.startsWith('system.adapter.ws.')
            ) {
                let file: string;
                // If debug version stored
                if (existsSync(`${__dirname}/${wwwDir}/lib/js/ws.js`)) {
                    file = `${__dirname}/${wwwDir}/lib/js/ws.js`;
                } else {
                    const pathToFile = require.resolve('iobroker.ws');
                    file = join(dirname(pathToFile), '/lib/socket.io.js');
                }
                this.socketIoFile = readFileSync(file);
            } else {
                // try to get a file from iobroker.socketio adapter
                let file: string | undefined;
                try {
                    const dir = require.resolve(`iobroker.socketio`);
                    file = join(dirname(dir), '/lib/socket.io.js');
                } catch {
                    // ignore
                }

                if (file && existsSync(file)) {
                    this.socketIoFile = readFileSync(file);
                } else {
                    try {
                        // try to get socket.io-client
                        const dir = require.resolve('socket.io-client');
                        const fileDir = join(dirname(dir), '../dist/');
                        if (existsSync(`${fileDir}socket.io.min.js`)) {
                            this.socketIoFile = readFileSync(`${fileDir}socket.io.min.js`);
                        } else {
                            this.socketIoFile = readFileSync(`${fileDir}socket.io.js`);
                        }
                    } catch {
                        try {
                            // if nothing works, read stored in a web file
                            this.socketIoFile = readFileSync(`${__dirname}/${wwwDir}/lib/js/socket.io.js`);
                        } catch (e) {
                            this.log.error(`Cannot read socket.io.js: ${e}`);
                            this.socketIoFile = false;
                        }
                    }
                }
            }

            if (this.socketIoFile) {
                res.contentType('application/javascript');
                res.set('Cache-Control', `public, max-age=${this.config.staticAssetCacheMaxAge}`);
                res.status(200).send(this.socketIoFile);
                return;
            }
            this.socketIoFile = false;
            res.status(404).end();
            return;
        }
        next();
    }

    isInWhiteList(req: Request | string): string {
        const remoteIp: string =
            typeof req === 'string'
                ? req
                : (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').toString();

        if (!this.config.auth) {
            return remoteIp;
        }
        if (this.config.whiteListSettings) {
            // if whitelist is used
            let whiteListIp = this.webServer.io?.getWhiteListIpForAddress(remoteIp, this.config.whiteListSettings);
            if (!whiteListIp && this.webServer.io && remoteIp === '::1') {
                whiteListIp = this.webServer.io.getWhiteListIpForAddress('localhost', this.config.whiteListSettings);
            }

            if (whiteListIp && this.config.whiteListSettings[whiteListIp].user !== 'auth') {
                this.log.silly(`whiteListIp ${whiteListIp}`);
                return whiteListIp;
            }
            this.log.debug(`Request from "${remoteIp}". Must authenticate, as IP not found in the white list`);
        }

        return '';
    }

    async getFoldersOfObject(path: string | undefined): Promise<string[]> {
        try {
            const projects = await this.readDirAsync(path || 'vis.0', '');
            return projects.filter(dir => dir.isDir).map(dir => dir.file);
        } catch (e) {
            this.log.warn(`Cannot read "${path || 'vis.0'}" directory: ${e}`);
        }

        return [];
    }

    async processReadFolders(req: Request, res: Response): Promise<void> {
        const params = (req.url || '').split('?')[1];
        const query: Record<string, string | boolean> = {};
        if (params) {
            const parts = params.split('&');
            for (let p = 0; p < parts.length; p++) {
                const parts2 = parts[p].split('=');
                query[decodeURIComponent(parts2[0])] = parts2[1] === undefined ? true : decodeURIComponent(parts2[1]);
                if (query[parts2[0]] === 'true') {
                    query[parts2[0]] = true;
                } else if (query[parts2[0]] === 'false') {
                    query[parts2[0]] = false;
                }
            }
        }

        if (this.config.auth) {
            // with basic authentication
            if (req.headers.authorization?.startsWith('Basic ')) {
                const [user, pass] = Buffer.from(req.headers.authorization.split(' ')[1], 'base64')
                    .toString()
                    .split(':');

                this.checkUser(
                    user,
                    pass,
                    async (_err: Error | null, result?: { logged_in: boolean; user?: string }): Promise<void> => {
                        if (result?.logged_in) {
                            const list = await this.getFoldersOfObject((query.adapter || '').toString());
                            res.json({ result: list });
                        } else {
                            res.status(401).json({ error: 'Unauthorized' });
                        }
                    },
                );
            } else {
                res.status(401).json({ error: 'Unauthorized' });
            }
        } else {
            const list = await this.getFoldersOfObject((query.adapter || '').toString());
            res.json({ result: list });
        }
    }

    async getSocketUrl(obj?: ioBroker.InstanceObject, state?: ioBroker.State | null): Promise<void> {
        if (this.config.socketio?.startsWith('system.adapter.')) {
            const socketInstance: ioBroker.InstanceObject | undefined =
                obj ||
                ((await this.getForeignObjectAsync(this.config.socketio)) as ioBroker.InstanceObject | undefined) ||
                undefined;

            if (socketInstance?.common && !socketInstance.common.enabled) {
                state ||= await this.getForeignStateAsync(`${this.config.socketio}.alive`);
                this.socketioAlive = !!state?.val;
                if (state?.val) {
                    this.socketUrl = `:${socketInstance.native.port}`;
                    return;
                }
            } else if (socketInstance?.common?.enabled && socketInstance.native) {
                this.socketUrl = `:${socketInstance.native.port}`;
                return;
            }
        }

        this.socketUrl = '';
    }

    async modifyIndexHtml(html: string): Promise<string> {
        const state = await this.getForeignStateAsync(`system.adapter.${this.namespace}.plugins.sentry.enabled`);

        return html
            .toString()
            .replaceAll(`@@vendorPrefix@@`, this.vendorPrefix)
            .replaceAll(`'@@disableDataReporting@@'`, state?.val ? 'true' : 'false')
            .replaceAll(`"@@disableDataReporting@@"`, state?.val ? 'true' : 'false')
            .replaceAll(`@@loadingBackgroundColor@@`, this.config.loadingBackgroundColor || '')
            .replaceAll(
                `@@loadingBackgroundImage@@`,
                this.config.loadingBackgroundImage ? `files/${this.namespace}/loading-bg.png` : '',
            )
            .replaceAll(`'@@loadingHideLogo@@'`, this.config.loadingHideLogo ? 'true' : 'false')
            .replaceAll(`"@@loadingHideLogo@@"`, this.config.loadingHideLogo ? 'true' : 'false')
            .replaceAll(`@@loginLanguage@@`, this.lang || '')
            .replaceAll(`@@loginOauth2@@`, this.config.loginOauth2 ? 'true' : 'false');
    }

    send404(res: Response, fileName: string, message?: string): void {
        this.template404 =
            this.template404 ||
            readFileSync(`${__dirname}/${wwwDir}/404.html`)
                .toString()
                .replace('{{Go to Homepage}}', this.I18n?.translate('Go to Homepage') || 'Go to Homepage')
                .replace('{{Refresh}}', this.I18n?.translate('Refresh') || 'Refresh');

        res.setHeader('Content-Type', 'text/html');
        res.status(404).send(
            this.template404.replace(
                '{{TEXT}}',
                this.I18n?.translate('File %s not found', escapeHtml(fileName)) +
                    (message && message !== '{}' ? `<br>${escapeHtml(message)}` : ''),
            ),
        );
    }

    async initWebServer(): Promise<void> {
        this.subscribeForeignObjects('system.config');

        this.config.ttl = parseInt(this.config.ttl as string, 10) || 3600;

        if (this.config.ttl < 30) {
            this.config.ttl = 30;
        }

        if (!this.config.whiteListEnabled && this.config.whiteListSettings) {
            delete this.config.whiteListSettings;
        }

        this.config.defaultUser = this.config.defaultUser || 'system.user.admin';
        if (!this.config.defaultUser.startsWith('system.user.')) {
            this.config.defaultUser = `system.user.${this.config.defaultUser}`;
        }

        if (this.config.port) {
            this.webServer.app = express();
            this.webServer.app.use(compression());

            this.webServer.app.disable('x-powered-by');
            // enable use of i-frames together with HTTPS
            // todo find the admin port and bind and use it here "ALLOW-FROM ipbind:port"
            // try to add "Content-Security-Policy: frame-ancestors 'self' example.com *.example.net ;"
            /*
            this.webServer.app.get('/*', (req: Request, res: Response, next: NextFunction): void => {
                res.header('X-Frame-Options' , 'SAMEORIGIN');
                next(); // http://expressjs.com/guide.html#passing-route control
            });
            */

            // replace socket.io
            this.webServer.app.use((req: Request, res: Response, next: NextFunction): void =>
                this.getSocketIoFile(req, res, next),
            );

            this.webServer.app.use((req: Request, _res: Response, next: NextFunction): void => {
                if (req.url.includes('/socket.io/')) {
                    req.url = req.url.replace(/.*\/socket.io\//, '/socket.io/');
                }
                next();
            });

            // special end point for vis
            this.webServer.app.get(
                '/visProjects',
                async (req: Request, res: Response): Promise<void> => await this.processReadFolders(req, res),
            );
            this.webServer.app.get(
                '/folders',
                async (req: Request, res: Response): Promise<void> => await this.processReadFolders(req, res),
            );

            if (this.config.auth) {
                this.initAuth();

                /**
                 * Authenticates at the server with the given username and password provided in req
                 *
                 * @param req - request object having property username and password
                 * @param res - response object
                 * @param next - express next function
                 * @param redirect - redirect path
                 * @param origin - origin path
                 */
                const authenticate = (
                    req: Request,
                    res: Response,
                    next: NextFunction,
                    redirect: string,
                    origin: string,
                ): void => {
                    passport.authenticate(
                        'local',
                        (
                            err: any,
                            user?: { logged_in: boolean; user: string } | null,
                            /* info?: object | string | Array<string | undefined>,
                            status?: number | Array<number | undefined>, */
                        ): void => {
                            // replace user
                            if (user?.user && this.config.userListEnabled) {
                                // get the user group
                                const longUser: `system.user.${string}` = user.user.startsWith('system.user.')
                                    ? (user.user as `system.user.${string}`)
                                    : `system.user.${user.user}`;
                                user.user = '';
                                if (this.config.userListSettings.users.includes(longUser)) {
                                    if (this.config.userListSettings.accessAsUser) {
                                        user.user = this.config.userListSettings.accessAsUser;
                                    } else {
                                        user.user = longUser;
                                    }
                                } else {
                                    const groupId: string | undefined = this.ownGroups
                                        ? Object.keys(this.ownGroups).find((groupId): boolean =>
                                              this.ownGroups![groupId as `system.group.${string}`]
                                                  ? this.ownGroups![
                                                        groupId as `system.group.${string}`
                                                    ].common.members.includes(longUser)
                                                  : false,
                                          )
                                        : undefined;
                                    if (
                                        groupId &&
                                        this.config.userListSettings.groups.includes(
                                            groupId as `system.group.${string}`,
                                        )
                                    ) {
                                        if (this.config.userListSettings.accessAsUser) {
                                            user.user = this.config.userListSettings.accessAsUser;
                                        } else {
                                            user.user = longUser;
                                        }
                                    }
                                }
                                if (!user?.user) {
                                    this.log.warn(`User ${longUser} is not in the user list`);
                                } else {
                                    this.log.debug(`User ${longUser} threaded as ${user.user}`);
                                    user.user = user.user.substring('system.user.'.length);
                                }
                            }

                            if (req.url.includes('/loginApp')) {
                                if (err) {
                                    this.log.warn(`Cannot login user: ${err}`);
                                    res.status(401).json({ error: 'cannot login user' });
                                    return;
                                }
                                if (!user?.user) {
                                    this.log.warn('User not found');
                                    res.status(401).json({ error: 'cannot login user' });
                                    return;
                                }
                            } else {
                                if (err) {
                                    this.log.warn(`Cannot login user: ${err}`);
                                    res.redirect(`/login/index.html${origin}${origin ? '&error' : '?error'}`);
                                    return;
                                }
                                if (!user?.user) {
                                    res.redirect(`/login/index.html${origin}${origin ? '&error' : '?error'}`);
                                    return;
                                }
                            }

                            req.logIn(user?.user, (err: Error | undefined): void => {
                                if (req.url.includes('/loginApp')) {
                                    if (err) {
                                        this.log.warn(`Cannot login user: ${err}`);
                                        res.status(401).json({ error: 'cannot login user' });
                                        return;
                                    }
                                } else {
                                    if (err) {
                                        this.log.warn(`Cannot login user: ${err}`);
                                        res.redirect(`/login/index.html${origin}${origin ? '&error' : '?error'}`);
                                        return;
                                    }
                                }
                                if (req.body.stayLoggedIn) {
                                    req.session.cookie.maxAge =
                                        ((this.config.ttl as number) || 3600) > ONE_MONTH_SEC
                                            ? ((this.config.ttl as number) || 3600) * 1000
                                            : ONE_MONTH_SEC * 1000;
                                } else {
                                    req.session.cookie.maxAge = ((this.config.ttl as number) || 3600) * 1000;
                                }
                                if (req.url.includes('/loginApp')) {
                                    res.json({ result: 'ok', user: user?.user });
                                } else {
                                    res.redirect(redirect);
                                }
                            });
                        },
                    )(req, res, next);
                };

                /**
                 * Auto Logon if possible else it will redirect or return Basic Auth information if activated
                 *
                 * @param req request object
                 * @param res response object
                 * @param next next function of express
                 * @param redirect redirect path
                 */
                const autoLogonOrRedirectToLogin = (
                    req: Request,
                    res: Response,
                    next: NextFunction,
                    redirect: string,
                ): void => {
                    let isJs;
                    if (/\.css(\?.*)?$/.test(req.originalUrl)) {
                        res.set('Cache-Control', `public, max-age=${this.config.staticAssetCacheMaxAge}`);
                        res.status(200).send('');
                        return;
                    }
                    if ((isJs = /\.js(\?.*)?$/.test(req.originalUrl))) {
                        // return always valid js file for js, because if cache is active it leads to errors
                        const parts = req.originalUrl.split('/');
                        parts.shift();

                        // if request for web/lib, ignore it, because no redirect information
                        if (parts[0] === 'lib') {
                            res.set('Cache-Control', `public, max-age=${this.config.staticAssetCacheMaxAge}`);
                            res.status(200).send('');
                            return;
                        }
                    }

                    const whiteListIp: string = this.isInWhiteList(req);

                    // if not authenticated
                    if (!whiteListIp) {
                        if (isJs) {
                            res.status(200).send(
                                `document.location="${LOGIN_PAGE}?href=" + encodeURI(location.href.replace(location.origin, ""));`,
                            );
                            return;
                        }

                        if (this.config.basicAuth) {
                            // if basic auth active, we tell it by sending a header with status 401
                            res.set('WWW-Authenticate', `Basic realm="Access to ioBroker web", charset="UTF-8"`);
                            res.status(401).send('Basic Authentication has been aborted. You have to reload the page.');
                            return;
                        }

                        res.redirect(redirect);
                        return;
                    }

                    if (this.config.whiteListSettings?.[whiteListIp]) {
                        req.logIn(this.config.whiteListSettings[whiteListIp].user.toString(), err => next(err));
                    } else {
                        next('No user found');
                    }
                };

                this.webServer.app.post('/login', (req: Request, res: Response, next: NextFunction): void => {
                    let redirect = getRedirectPage(req);

                    req.body.password = (req.body.password || '').toString();
                    req.body.username = (req.body.username || '').toString();
                    req.body.stayLoggedIn =
                        req.body.stayloggedin === 'true' ||
                        req.body.stayloggedin === true ||
                        req.body.stayloggedin === 'on';

                    if (req.body.username && this.config.addUserName && !redirect.includes('?')) {
                        const parts = redirect.split('#');
                        parts[0] += `?${req.body.username}`;
                        redirect = parts.join('#');
                    }

                    // User tries to authenticate with old method, so delete OAuth2 token
                    res.clearCookie('access_token');

                    authenticate(req, res, next, redirect, req.body.origin || '?href=%2F');
                });

                // Login for applications to preserve cookie
                this.webServer.app.post('/loginApp', (req: Request, res: Response, next: NextFunction): void => {
                    req.body.password = (req.body.password || '').toString();
                    req.body.username = (req.body.username || '').toString();
                    req.body.stayLoggedIn =
                        req.body.stayloggedin === 'true' ||
                        req.body.stayloggedin === true ||
                        req.body.stayloggedin === 'on';

                    authenticate(req, res, next, '', req.body.origin || '?href=%2F');
                });

                this.webServer.app.get('/logout', (req: Request, res: Response): void => {
                    const isDev = req.url.includes('?dev');
                    req.logout(() => {
                        if (isDev) {
                            res.redirect('http://localhost:3000/index.html?login');
                        } else {
                            res.redirect(LOGIN_PAGE);
                        }
                    });
                });

                // route middleware to make sure a user is logged in
                this.webServer.app.use((req, res, next): void => {
                    const url = req.originalUrl.split('?')[0];

                    const isAuthenticated =
                        !this.config.auth ||
                        (req.isAuthenticated && req.isAuthenticated()) ||
                        (!req.isAuthenticated && req.user);

                    if (url === '/auth') {
                        // User can ask server if authentication enabled
                        res.setHeader('Content-Type', 'application/json');
                        res.json({ auth: this.config.auth });
                        return;
                    }

                    if (url === '/name') {
                        // User can ask server if authentication enabled
                        res.setHeader('Content-Type', 'plain/text');
                        res.send(this.namespace);
                        return;
                    }

                    // return favicon always
                    if (!isAuthenticated && url.endsWith('favicon.ico')) {
                        res.set('Content-Type', 'image/x-icon');
                        res.send(readFileSync(`${__dirname}/${wwwDir}/login/favicon.ico`));
                        return;
                    }
                    if (!isAuthenticated && url.endsWith('manifest.json')) {
                        res.set('Content-Type', 'application/json');
                        res.send(readFileSync(`${__dirname}/${wwwDir}/login/manifest.json`));
                        return;
                    }
                    // if cache.manifest got back not 200, it makes an error
                    if (
                        isAuthenticated ||
                        /web\.\d+\/login-bg\.png$/.test(url) ||
                        url.endsWith('.ico') ||
                        url.endsWith('manifest.json') ||
                        url.endsWith('cache.manifest.json') ||
                        url.startsWith('/login/')
                    ) {
                        next();
                        return;
                    }
                    if (
                        this.config.basicAuth &&
                        typeof req.headers.authorization === 'string' &&
                        req.headers.authorization.startsWith('Basic')
                    ) {
                        // not logged in yet, and basic auth is active + header present
                        const b64auth = req.headers.authorization.split(' ')[1];
                        const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

                        req.body = req.body || {};

                        req.body.username = login;
                        req.body.password = password;
                        req.body.stayLoggedIn =
                            req.body.stayloggedin === 'true' ||
                            req.body.stayloggedin === true ||
                            req.body.stayloggedin === 'on';

                        const origin = req.body.origin || '?href=%2F';
                        const redirect = req.originalUrl;

                        authenticate(req, res, next, redirect, origin);
                    } else {
                        // not logged in yet, redirect, auto login or send 401 if basicAuth activated
                        autoLogonOrRedirectToLogin(
                            req,
                            res,
                            next,
                            `${LOGIN_PAGE}?href=${encodeURIComponent(req.originalUrl)}`,
                        );
                    }
                });

                // get user by session /cookie
                this.webServer.app.get('/getUser', (req: Request, res: Response): void => {
                    const isAuthenticated =
                        !this.config.auth ||
                        (req.isAuthenticated && req.isAuthenticated()) ||
                        (!req.isAuthenticated && req.user);

                    if (isAuthenticated) {
                        // parse cookie
                        const cookie: Record<string, string> = {};
                        const parts = (req.headers.cookie || '').split(';');
                        parts.forEach(item => {
                            const [name, value] = item.split('=');
                            cookie[decodeURIComponent(name.trim())] = decodeURIComponent(value);
                        });

                        let accessToken = cookie.access_token;
                        if (!accessToken && req.headers.authorization?.startsWith('Bearer ')) {
                            accessToken = req.headers.authorization.split(' ')[1];
                        }
                        if (!accessToken && req.query?.token) {
                            accessToken = req.query.token as string;
                        }

                        // If access token is available, use it
                        if (accessToken) {
                            // read expiration from session
                            this.store?.get(`a:${accessToken}`, (_err, accessSession) => {
                                const tokens = accessSession as unknown as InternalStorageToken;
                                if (tokens) {
                                    // If refresh token is available, use it
                                    res.send({
                                        expires: new Date(tokens.aExp).toISOString(),
                                        refreshExpires: new Date(tokens.rExp).toISOString(),
                                        user: tokens.user,
                                    });
                                } else {
                                    res.status(501).send('User not logged in.');
                                }
                            });
                            return;
                        }

                        if (cookie['connect.sid']) {
                            const sessionId = signature.unsign(
                                decodeURIComponent(cookie['connect.sid']).slice(2),
                                this.secret,
                            );
                            if (sessionId) {
                                this.store?.get(
                                    sessionId,
                                    (
                                        err: Error | null,
                                        session?: {
                                            cookie: {
                                                originalMaxAge: number;
                                                expires: string;
                                                httpOnly: boolean;
                                                path: string;
                                            };
                                            passport: {
                                                user: string;
                                            };
                                        },
                                    ): void => {
                                        // obj = {"cookie":{"originalMaxAge":2592000000,"expires":"2020-09-24T18:09:50.377Z","httpOnly":true,"path":"/"},"passport":{"user":"admin"}}
                                        if (session) {
                                            res.send({ expires: session.cookie.expires, user: session.passport.user });
                                        } else {
                                            res.status(501).send('User not logged in.');
                                        }
                                    },
                                );
                            } else {
                                res.status(501).send('User not logged in.');
                            }
                        } else {
                            if (!req.user) {
                                res.status(501).send('User not logged in.');
                            } else {
                                res.send({ user: req.user });
                            }
                        }
                    } else {
                        res.status(501).send('User not logged in.');
                    }
                });

                // todo
                this.webServer.app.get('/prolongSession', (req: Request, res: Response, next: NextFunction): void => {
                    const isAuthenticated =
                        !this.config.auth ||
                        (req.isAuthenticated && req.isAuthenticated()) ||
                        (!req.isAuthenticated && req.user);

                    if (isAuthenticated) {
                        req.session.touch();
                        const parts = (req.headers.cookie || '').split(';');
                        const cookie: Record<string, string> = {};
                        parts.forEach(item => {
                            const [name, value] = item.split('=');
                            cookie[decodeURIComponent(name.trim())] = decodeURIComponent(value || '');
                        });

                        if (cookie['connect.sid']) {
                            const sessionId = signature.unsign(
                                decodeURIComponent(cookie['connect.sid']).slice(2),
                                this.secret,
                            );
                            if (sessionId) {
                                this.store?.get(
                                    sessionId,
                                    (
                                        _err: Error | null,
                                        obj?: {
                                            cookie: {
                                                originalMaxAge: number;
                                                expires: string;
                                                httpOnly: boolean;
                                                path: string;
                                            };
                                            passport: {
                                                user: string;
                                            };
                                        },
                                    ): void => {
                                        // obj = {"cookie":{"originalMaxAge":2592000000,"expires":"2020-09-24T18:09:50.377Z","httpOnly":true,"path":"/"},"passport":{"user":"admin"}}
                                        if (obj) {
                                            const expires = new Date();
                                            // expires.setMilliseconds(expires.getMilliseconds() + req.session.cookie.maxAge);

                                            obj.cookie.expires = expires.toISOString();
                                            console.log(`Session ${req.session.id} expires on ${obj.cookie.expires}`);

                                            this.store?.set(req.session.id, obj);
                                            //res.cookie('connect.sid', cookie['connect.sid'], { maxAge: req.session.cookie.maxAge, httpOnly: true });
                                            res.send({ expires: obj.cookie.expires, user: obj.passport.user });
                                        } else {
                                            res.status(501).send('cannot prolong');
                                        }
                                    },
                                );
                            } else {
                                res.status(501).send('cannot prolong');
                            }
                        } else {
                            res.status(501).send('cannot prolong');
                        }
                    } else {
                        autoLogonOrRedirectToLogin(
                            req,
                            res,
                            next,
                            `${LOGIN_PAGE}?href=${encodeURIComponent(req.originalUrl)}`,
                        );
                    }
                });
            } else {
                this.webServer.app.get('/iobroker_check.html', (req: Request, res: Response): void => {
                    res.send('ioBroker.web');
                });
                this.webServer.app.get('/login', (req: Request, res: Response): void => res.redirect('/'));
                this.webServer.app.get('/logout', (req: Request, res: Response): void => res.redirect('/'));

                if (this.config.whiteListEnabled) {
                    this.initAuth();
                    this.webServer.app.use((req, res, next) => {
                        const remoteIp = (
                            req.headers['x-forwarded-for'] ||
                            req.connection.remoteAddress ||
                            ''
                        ).toString();
                        let whiteListIp: string | undefined;
                        if (this.config.whiteListSettings) {
                            let whiteListIp = this.webServer?.io?.getWhiteListIpForAddress(
                                remoteIp,
                                this.config.whiteListSettings,
                            );
                            if (!whiteListIp && this.webServer.io && remoteIp === '::1') {
                                whiteListIp = this.webServer.io.getWhiteListIpForAddress(
                                    'localhost',
                                    this.config.whiteListSettings,
                                );
                            }
                            this.log.silly(`whiteListIp ${whiteListIp}`);
                        }

                        if (whiteListIp && this.config.whiteListSettings?.[whiteListIp]) {
                            req.logIn(this.config.whiteListSettings[whiteListIp].user, err => next(err));
                        } else {
                            req.logIn(
                                this.config.defaultUser.substring('system.user.'.length), // remove 'system.user.'
                                (
                                    err, // cut "system.user."
                                ) => next(err),
                            );
                        }
                    });
                }
            }

            if (!this.config.disableStates) {
                this.log.debug('Activating states & socket info');
                // Init read from states
                this.webServer.app.get('/state/*', (req: Request, res: Response): void => {
                    try {
                        const fileName = req.url.split('/', 3)[2].split('?', 2);
                        void this.getForeignObject(
                            fileName[0],
                            (err: Error | null | undefined, obj?: ioBroker.Object | null): void => {
                                let contentType: string | false = 'text/plain';
                                if (obj?.common?.type === 'file') {
                                    contentType = lookup(fileName[0]);
                                }
                                if (obj?.common?.type === 'file') {
                                    // @ts-expect-error deprecated
                                    const getForeignBinaryState = this.getForeignBinaryState || this.getBinaryState;
                                    getForeignBinaryState.call(
                                        this,
                                        fileName[0],
                                        {
                                            user: req.user
                                                ? `system.user.${req.user as string}`
                                                : this.config.defaultUser,
                                        },
                                        (err: Error | null | undefined, obj?: Buffer | ioBroker.State | null): void => {
                                            if (!err && obj !== null && obj !== undefined) {
                                                if (
                                                    obj &&
                                                    typeof obj === 'object' &&
                                                    (obj as ioBroker.State).val !== undefined &&
                                                    (obj as ioBroker.State).ack !== undefined
                                                ) {
                                                    res.set('Content-Type', 'application/json');
                                                } else {
                                                    res.set('Content-Type', contentType || 'text/plain');
                                                }
                                                res.set('Cache-Control', 'no-cache');
                                                res.status(200).send(obj);
                                            } else {
                                                this.send404(res, fileName[0]);
                                            }
                                        },
                                    );
                                } else {
                                    void this.getForeignState(
                                        fileName[0],
                                        {
                                            user: req.user
                                                ? `system.user.${req.user as string}`
                                                : this.config.defaultUser,
                                        },
                                        (err, obj) => {
                                            if (!err && obj !== null && obj !== undefined) {
                                                res.set('Content-Type', 'text/plain');
                                                res.set('Cache-Control', 'no-cache');
                                                if (fileName[1]?.includes('json')) {
                                                    res.status(200).send(JSON.stringify(obj));
                                                } else {
                                                    res.status(200).send(
                                                        obj.val === undefined
                                                            ? 'undefined'
                                                            : obj.val === null
                                                              ? 'null'
                                                              : typeof obj.val === 'object'
                                                                ? JSON.stringify(obj.val)
                                                                : obj.val.toString(),
                                                    );
                                                }
                                            } else {
                                                this.send404(res, fileName[0]);
                                            }
                                        },
                                    );
                                }
                            },
                        );
                    } catch (e) {
                        res.status(500).send(`500. Error${e}`);
                    }
                });
            }

            this.webServer.app.get('*/_socket/info.js', (req: Request, res: Response): void => {
                res.set('Content-Type', 'application/javascript');
                res.set('Cache-Control', 'no-cache');
                res.status(200).send(this.getInfoJs());
            });

            this.webServer.app.get('/config.json', async (req: Request, res: Response): Promise<void> => {
                res.set('Content-Type', 'application/javascript');
                res.set('Cache-Control', 'no-cache');
                const config = await this.getListOfAllAdapters(
                    (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').toString(),
                );
                res.status(200).send(JSON.stringify(config, null, 2));
            });

            if (this.config.accessControlEnabled) {
                this.webServer.app.use((req, res, next) => {
                    res.header(
                        'Access-Control-Allow-Origin',
                        this.config.accessControlAllowOrigin || req.headers.origin,
                    );
                    res.header('Access-Control-Allow-Methods', this.config.accessControlAllowMethods);
                    res.header('Access-Control-Allow-Headers', this.config.accessControlAllowHeaders);
                    res.header(
                        'Access-Control-Allow-Credentials',
                        this.config.accessControlAllowCredentials ? 'true' : 'false',
                    );
                    if (this.config.accessControlExposeHeaders) {
                        res.header('Access-Control-Expose-Headers', this.config.accessControlExposeHeaders);
                    }
                    if (this.config.accessControlMaxAge) {
                        res.header('Access-Control-Max-Age', this.config.accessControlMaxAge.toString());
                    }

                    // intercept OPTIONS method
                    if ('OPTIONS' === req.method) {
                        res.status(200).send(200);
                    } else {
                        next();
                    }
                });
            } else if (this.config.socketio || this.common!.loglevel === 'debug') {
                // Enable CORS
                this.webServer.app.use((req, res, next) => {
                    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
                    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
                    res.header(
                        'Access-Control-Allow-Headers',
                        'Content-Type, Authorization, Content-Length, X-Requested-With, *',
                    );
                    res.header('Access-Control-Allow-Credentials', 'true');

                    // intercept OPTIONS method
                    if ('OPTIONS' === req.method) {
                        res.status(200).send(200);
                    } else {
                        next();
                    }
                });
            }

            const appOptions: { maxAge?: number } = {};
            if (this.config.cache) {
                appOptions.maxAge = 30758400000; // one year
            }

            try {
                const webserver = new WebServer({
                    app: this.webServer.app,
                    adapter: this,
                    secure: this.config.secure,
                });
                this.webServer.server = (await webserver.init()) as Server & { __server: WebStructure };
            } catch (err) {
                this.log.error(`Cannot create web-server: ${err}`);
                this.terminate
                    ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return;
            }
            if (!this.webServer.server) {
                this.log.error(`Cannot create web-server`);
                this.terminate
                    ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return;
            }

            this.webServer.server.__server = this.webServer;
        } else {
            this.log.error('port missing');
            this.terminate
                ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
        }

        if (this.webServer.server) {
            let serverListening = false;
            let serverPort: number;
            this.webServer.server.on('error', e => {
                if (e.toString().includes('EACCES') && serverPort <= 1024) {
                    this.log.error(
                        `node.js process has no rights to start server on the port ${serverPort}.\n` +
                            `Do you know that on linux you need special permissions for ports under 1024?\n` +
                            `You can call in shell following scrip to allow it for node.js: "iobroker fix"`,
                    );
                } else {
                    this.log.error(`Cannot start server on ${this.config.bind || '0.0.0.0'}:${serverPort}: ${e}`);
                }
                if (!serverListening) {
                    this.terminate
                        ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                        : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                }
            });

            this.config.port = parseInt(this.config.port as string, 10) || 8082;
            serverPort = this.config.port;

            this.getPort(
                this.config.port,
                !this.config.bind || this.config.bind === '0.0.0.0' ? undefined : this.config.bind || undefined,
                port => {
                    port = parseInt(port as unknown as string, 10);
                    if (port !== this.config.port) {
                        this.log.error(`port ${this.config.port} already in use`);
                        this.terminate
                            ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                            : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                    }
                    serverPort = port;
                    this.webServer.server!.listen(
                        port,
                        !this.config.bind || this.config.bind === '0.0.0.0' ? undefined : this.config.bind || undefined,
                        () => {
                            serverListening = true;
                            void this.setState('info.connection', true, true);

                            if (!this.config.doNotCheckPublicIP && !this.config.auth) {
                                this.checkTimeout = this.setTimeout(async () => {
                                    this.checkTimeout = null;
                                    try {
                                        await checkPublicIP(this.config.port, 'ioBroker.web', '/iobroker_check.html');
                                    } catch (e) {
                                        // this supported first from js-controller 5.0.
                                        this.sendToHost(
                                            `system.host.${this.host}`,
                                            'addNotification',
                                            {
                                                scope: 'system',
                                                category: 'securityIssues',
                                                message:
                                                    'Your web instance is accessible from the internet without any protection. ' +
                                                    'Please enable authentication or disable the access from the internet.',
                                                instance: `system.adapter.${this.namespace}`,
                                            },
                                            (/* result */) => {
                                                /* ignore */
                                            },
                                        );

                                        this.log.error(e.toString());
                                    }
                                }, 1000);
                            }
                        },
                    );

                    this.log.info(`http${this.config.secure ? 's' : ''} server listening on port ${port}`);
                },
            );
        }

        // Activate integrated socket
        if (this.ownSocket) {
            this.log.debug('Activating IOSocket');
            const socketSettings: SocketSettings = JSON.parse(JSON.stringify(this.config));
            // Authentication checked by server itself
            socketSettings.secret = this.secret;
            socketSettings.language = this.config.language;

            // Used only for socket.io
            socketSettings.forceWebSockets = !!this.config.forceWebSockets;
            // Used only for socket.io
            socketSettings.compatibilityV2 = this.config.compatibilityV2 !== false;

            try {
                let path = this.config.usePureWebSockets ? `iobroker.ws` : 'iobroker.socketio';
                let filePath = require.resolve(path);

                filePath = filePath.replace(/\\/g, '/');
                // create a path to socket.js
                const parts = filePath.split('/');
                parts.pop(); // main.js
                if (filePath.replace(/\\/g, '/').endsWith('/dist/main.js')) {
                    path += '/dist/lib/socket.js';
                } else {
                    path += '/lib/socket.js';
                }

                let pack: any = await import(path);
                if (pack.default) {
                    pack = pack.default;
                }
                if (pack.Socket) {
                    pack = pack.Socket;
                }
                const IOSocket = pack as typeof IOSocketClass;

                // const IOSocket = require('./lib/socket.js'); // DEBUG
                this.webServer.io = new IOSocket(
                    this.webServer.server as Server,
                    socketSettings,
                    this,
                    this.store!,
                    this.checkUser,
                );
            } catch (err) {
                this.log.error('Initialization of integrated socket.io failed. Please reinstall the web adapter.');
                if (err.message) {
                    this.log.error(`ERROR: ${err.message}`);
                    this.log.error(err.stack);
                } else {
                    this.log.error(JSON.stringify(err));
                }
            }
        }

        const extensionPromises: Promise<void>[] = [];

        if (!this.config.disableExtensions) {
            this.log.debug('Activating extensions');
            // activate extensions
            Object.keys(this.extensions).forEach(instance => {
                try {
                    // for debug purposes, try to load a file in current directory "/lib/file.js" (elsewise node.js cannot debug it)
                    const parts = this.extensions[instance].path.split('/');
                    parts.shift();
                    let extAPI;
                    if (existsSync(`./${parts.join('/')}`)) {
                        extAPI = require(`./${parts.join('/')}`);
                    } else {
                        extAPI = require(`iobroker.${this.extensions[instance].path}`);
                    }
                    // if loaded from TS
                    if (extAPI.default) {
                        extAPI = extAPI.default;
                    }
                    const className = (this.extensions[instance].path.split('/').pop() || '').split('.')[0];
                    if (extAPI[className]) {
                        extAPI = extAPI[className];
                    }

                    this.log.info(`Connecting extension "${this.extensions[instance].path}"`);

                    // Start web-extension
                    this.extensions[instance].obj = new extAPI(
                        this.webServer.server,
                        {
                            secure: this.config.secure,
                            port: this.config.port,
                            language: this.config.language,
                            defaultUser: this.config.defaultUser,
                            auth: this.config.auth,
                        },
                        this,
                        this.extensions[instance].config,
                        this.webServer.app,
                        this.webServer.io,
                    );

                    if (
                        this.extensions[instance].obj?.waitForReady &&
                        typeof this.extensions[instance].obj.waitForReady === 'function'
                    ) {
                        extensionPromises.push(
                            new Promise<void>(resolve => {
                                let timeout: ioBroker.Timeout | undefined = this.setTimeout(() => {
                                    if (timeout) {
                                        timeout = undefined;
                                        this.log.error(
                                            `Extension "${instance}" (${this.extensions[instance].path}) is not responding (waitForReady)`,
                                        );
                                        resolve();
                                    }
                                }, this.extensions[instance].obj!.waitForReadyTime || 5000);

                                const ready = (): void => {
                                    if (timeout) {
                                        this.log.debug(`Connected extension "${this.extensions[instance].path}"`);
                                        this.clearTimeout(timeout);
                                        timeout = null;
                                        resolve();
                                    }
                                };

                                this.extensions[instance].obj!.waitForReady!(ready);
                            }),
                        );
                    }
                } catch (err) {
                    this.log.error(`Cannot start extension "${instance}": ${err}`);
                }
            });
        }

        void Promise.all(extensionPromises).then(() => {
            if (this.webServer.app && !this.config.disableFilesObjects) {
                this.log.debug('Activating web files from objectDB');

                // deliver web files from objectDB
                this.webServer.app.use(async (req: Request, res: Response): Promise<void> => {
                    let url;
                    try {
                        url = decodeURI(req.url);
                    } catch {
                        //
                        this.log.warn(`Cannot decode URI: "${req.url}`);
                        url = req.url;
                    }
                    // remove all ../
                    // important: Linux does not normalize "\" but fs.readFile accepts it as '/'
                    url = normalize(url.replace(/\\/g, '/')).replace(/\\/g, '/');
                    // remove '////' at start and let only one
                    if (url[0] === '/' && url[1] === '/') {
                        let i = 2;
                        while (url[i] === '/') {
                            i++;
                        }
                        url = url.substring(i - 1);
                    }
                    if ((url[0] === '.' && url[1] === '.') || (url[0] === '/' && url[1] === '.' && url[2] === '.')) {
                        this.send404(res, url);
                        return;
                    }
                    url = url.split('?')[0];

                    // If root directory requested
                    if (url === '/' || url === '/index.html') {
                        if (this.config.defaultRedirect) {
                            res.redirect(301, this.config.defaultRedirect);
                            return;
                        }
                        this.getIndexHtml(req)
                            .then(html =>
                                res
                                    .set('Content-Type', 'text/html')
                                    .set('Cache-Control', 'no-cache')
                                    .status(200)
                                    .send(html),
                            )
                            .catch(err =>
                                res
                                    .status(500)
                                    .send(`500. Error${escapeHtml(typeof err !== 'string' ? err.toString() : err)}`),
                            );
                        return;
                    } else if (url === '/logo.svg') {
                        res.set('Content-Type', 'image/svg+xml')
                            .set('Cache-Control', 'public, max-age=2147483647')
                            .status(200)
                            .send(readFileSync(`${__dirname}/${wwwDir}${url}`));
                        return;
                    } else if (url === '/favicon.ico') {
                        res.set('Content-Type', 'image/x-icon')
                            .set('Cache-Control', 'public, max-age=2147483647')
                            .status(200)
                            .send(readFileSync(`${__dirname}/${wwwDir}${url}`));
                        return;
                    } else if (url === '/manifest.json') {
                        res.set('Content-Type', 'application/json')
                            .set('Cache-Control', 'public, max-age=2147483647')
                            .status(200)
                            .send(readFileSync(`${__dirname}/${wwwDir}${url}`));
                        return;
                    }

                    // add index.html
                    url = url.replace(/\/($|\?|#)/, '/index.html$1');

                    if (url.startsWith('/adapter/')) {
                        // add .admin to adapter name
                        url = url.replace(/^\/adapter\/([a-zA-Z0-9-_]+)\//, '/$1.admin/');
                    }

                    if (url.startsWith('/lib/')) {
                        url = `/${this.name}${url}`;
                    }
                    if (url.startsWith('/assets/')) {
                        url = `/${this.name}${url}`;
                    }
                    if (url.startsWith('/admin/')) {
                        url = `/${this.name}${url}`;
                    }
                    const urlParts: string[] = url.split('/');
                    // Skip first /
                    urlParts.shift();
                    // Get ID
                    const id = urlParts.shift() || '';
                    const versionPrefix = urlParts[0];
                    url = urlParts.join('/');
                    const pos = url.indexOf('?');
                    let noFileCache;
                    if (pos !== -1) {
                        url = url.substring(0, pos);
                        // disable file cache if request like /vis/files/picture.png?noCache
                        noFileCache = true;
                    }

                    // get adapter name
                    if (this.webByVersion[id] && !url.startsWith('socket.io/')) {
                        if (!versionPrefix || !versionPrefix.match(/^\d+\.\d+.\d+$/)) {
                            // redirect to version
                            res.set('location', `/${id}/${this.webByVersion[id]}/${url}`);
                            res.status(301).send();
                            return;
                        }
                    }

                    if (this.cache?.[`${id}/${url}`] && !noFileCache) {
                        res.contentType(this.cache[`${id}/${url}`].mimeType);
                        if (req.headers.range) {
                            this.sendRange(req, res, this.cache[`${id}/${url}`].buffer);
                        } else {
                            res.set('Cache-Control', `public, max-age=${this.config.staticAssetCacheMaxAge}`);
                            res.status(200).send(this.cache[`${id}/${url}`].buffer);
                        }
                    } else {
                        if (id === 'login' && url === 'index.html') {
                            this.loginPage ||= await this.modifyIndexHtml(
                                readFileSync(`${__dirname}/${wwwDir}${LOGIN_PAGE}`).toString('utf8'),
                            );
                            const buffer = this.loginPage;

                            const isAuthenticated =
                                !this.config.auth ||
                                (req.isAuthenticated && req.isAuthenticated()) ||
                                (!req.isAuthenticated && req.user);

                            if (isAuthenticated || this.isInWhiteList(req)) {
                                res.redirect(getRedirectPage(req));
                                return;
                            }

                            if (buffer === null || buffer === undefined) {
                                res.contentType('text/html');
                                res.set('Cache-Control', 'no-cache');
                                this.send404(res, url);
                            } else {
                                // Store file in cache
                                if (this.config.cache) {
                                    this.cache[`${id}/${url}`] = { buffer: Buffer.from(buffer), mimeType: 'text/html' };
                                }
                                res.set('Cache-Control', 'no-cache');
                                res.contentType('text/html');
                                res.status(200).send(buffer.toString());
                            }
                        } else {
                            // special solution for socket.io
                            if (url.endsWith('socket.io.js') || url.match(/\/socket\.io\.js(\?.*)?$/)) {
                                this.getSocketIoFile(req, res, true);
                                return;
                            }
                            let result: { file: string | Buffer; mimeType?: string } | null | undefined;
                            let error: Error | undefined;
                            try {
                                result = await this.readFileAsync(
                                    id,
                                    this.webByVersion[id] && versionPrefix
                                        ? url.substring(versionPrefix.length + 1)
                                        : url,
                                    {
                                        user: req.user ? `system.user.${req.user as string}` : this.config.defaultUser,
                                        noFileCache,
                                    },
                                );
                            } catch (err) {
                                error = err;
                            }
                            if (
                                this.config.showFolderIndex &&
                                error?.toString() === 'Error: Not exists' &&
                                req.url.endsWith('/')
                            ) {
                                url = url.replace(/\/?index.html$/, '');
                                // show folder index

                                const path: string =
                                    this.webByVersion[id] && versionPrefix
                                        ? url.substring(versionPrefix.length + 1)
                                        : url;

                                try {
                                    const files: ioBroker.ReadDirResult[] | undefined = await this.readDirAsync(
                                        id,
                                        path,
                                        {
                                            user: req.user
                                                ? `system.user.${req.user as string}`
                                                : this.config.defaultUser,
                                        },
                                    );
                                    this.log.debug(`readDir ${id} (${path}): ${JSON.stringify(files)}`);

                                    res.set('Cache-Control', `public, max-age=${this.config.staticAssetCacheMaxAge}`);
                                    res.set('Content-Type', 'text/html; charset=utf-8');
                                    this.templateDir ||= readFileSync(`${__dirname}/${wwwDir}/dir.html`)
                                        .toString('utf8')
                                        .replace('{{Directory}}', this.I18n?.translate('Directory') || 'Directory')
                                        .replace('{{File Size}}', this.I18n?.translate('File Size') || 'File Size')
                                        .replace('{{File Name}}', this.I18n?.translate('File Name') || 'File Name');
                                    const text = [];

                                    if (url !== '/') {
                                        const parts = url.split('/');
                                        parts.pop();
                                        text.push(`<tr><td><a href="../">..</a></td><td></td></tr>`);
                                    }

                                    files?.sort((a, b) => {
                                        if (a.isDir && b.isDir) {
                                            return a.file.localeCompare(b.file);
                                        }
                                        if (a.isDir) {
                                            return -1;
                                        }
                                        if (b.isDir) {
                                            return 1;
                                        }

                                        return a.file.localeCompare(b.file);
                                    });

                                    files?.forEach(file =>
                                        text.push(
                                            `<tr><td><a href="./${file.file}${file.isDir ? '/' : ''}" style="${file.isDir ? 'font-weight: bold' : ''}">${file.file}</a></td><td>${(file.stats && file.stats.size) || ''}</td></tr>`,
                                        ),
                                    );
                                    res.status(200).send(
                                        this.templateDir
                                            .replace('{{URL}}', req.url)
                                            .replace('{{TABLE}}', text.join('\n')),
                                    );
                                } catch (e) {
                                    this.log.warn(`Cannot get folder index "${id}/${path}: ${e}`);
                                    this.send404(res, url);
                                }
                                return;
                            }

                            if (!result || result.file === null || result.file === undefined || error) {
                                res.contentType('text/html');
                                this.send404(res, url, typeof error !== 'string' ? JSON.stringify(error) : error);
                            } else {
                                result.mimeType = result.mimeType || lookup(url) || 'application/javascript';

                                // replace some important variables in HTML
                                if (url === 'index.html' || url === 'edit.html') {
                                    result.file = await this.modifyIndexHtml(result.file.toString('utf8'));
                                }

                                // Store file in cache
                                if (this.config.cache) {
                                    this.cache[`${id}/${url}`] = {
                                        buffer: Buffer.from(result.file as any),
                                        mimeType: result.mimeType,
                                    };
                                }

                                res.contentType(result.mimeType);

                                if (req.headers.range) {
                                    this.sendRange(req, res, Buffer.from(result.file as any));
                                } else {
                                    res.set('Cache-Control', `public, max-age=${this.config.staticAssetCacheMaxAge}`);
                                    res.status(200).send(result.file);
                                }
                            }
                        }
                    }
                });
            }
        });
    }

    async main(): Promise<void> {
        let ext: ioBroker.InstanceObject[] | undefined;

        try {
            ext = await this.getExtensionsAndSettings();
        } catch (err) {
            this.log.error(`Cannot read extensions: ${err}`);
        }

        if (ext) {
            for (let e = 0; e < ext.length; e++) {
                if (ext[e]?.common) {
                    const instance = ext[e]._id.substring('system.adapter.'.length);
                    const name = instance.split('.')[0];

                    this.extensions[instance] = {
                        path: `${name}/${ext[e].common.webExtension}`,
                        config: ext[e],
                    };
                }
            }
        }

        if (this.config.userListSettings) {
            try {
                const _users = await this.getObjectViewAsync('system', 'user', {
                    startkey: 'system.user.',
                    endkey: 'system.user.\u9999',
                });
                this.ownUsers = {};
                for (let u = 0; u < _users.rows.length; u++) {
                    this.ownUsers[_users.rows[u].value._id] = _users.rows[u].value;
                }
            } catch (e) {
                this.log.error(`Cannot read users: ${e}`);
            }

            try {
                const _groups = await this.getObjectViewAsync('system', 'group', {
                    startkey: 'system.group.',
                    endkey: 'system.group.\u9999',
                });
                this.ownGroups = {};
                for (let u = 0; u < _groups.rows.length; u++) {
                    this.ownGroups[_groups.rows[u].value._id] = _groups.rows[u].value;
                }
            } catch (e) {
                this.log.error(`Cannot read users: ${e}`);
            }
            await this.subscribeForeignObjectsAsync('system.user.*');
            await this.subscribeForeignObjectsAsync('system.group.*');
        }

        try {
            await this.initWebServer();
        } catch (err) {
            this.log.error(`Failed to initWebServer: ${err}`);
            this.terminate
                ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
        }

        // monitor extensions and pro keys
        await this.subscribeForeignObjectsAsync('system.adapter.*');
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new WebAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new WebAdapter())();
}
