import type { IncomingMessage } from 'node:http';
import { Buffer } from 'node:buffer';
import type { RequestHandler } from 'express';
/** Url where controller changelog is reachable */
export declare const CONTROLLER_CHANGELOG_URL = "https://github.com/ioBroker/ioBroker.js-controller/blob/master/CHANGELOG.md";
/** All possible auto upgrade settings */
export declare const AUTO_UPGRADE_SETTINGS: ioBroker.AutoUpgradePolicy[];
/** Mapping to make it more understandable which upgrades are allowed */
export declare const AUTO_UPGRADE_OPTIONS_MAPPING: Record<ioBroker.AutoUpgradePolicy, string>;
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
export declare function replaceLink(link: string, adapter: string, instance: number, context: {
    instances: Record<string, ioBroker.InstanceObject>;
    hostname: string;
    adminInstance: string;
    hosts: Record<string, ioBroker.HostObject>;
}): {
    url: string;
    port: number | undefined;
    instance?: string;
}[];
/** The part of a request that the login redirect helpers read */
export interface LoginRequest {
    /** Body of the posted login form */
    body?: {
        origin?: string;
    };
    /** Parsed query string of the request */
    query?: Record<string, any>;
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
export declare function getRequestedPage(req: LoginRequest): string | null;
/**
 * Page the user is sent to after a successful login
 *
 * @param req request of the login page
 * @returns the requested path, or `../` - the root of this server - if there is none
 */
export declare function getRedirectPage(req: LoginRequest): string;
/**
 * URL of the login page that shows the "wrong password" message
 *
 * The requested page is carried along fully encoded, so it survives a failed attempt and the
 * `error` flag stays in the query string, where the login page looks for it.
 *
 * @param loginPage path of the login page
 * @param req request of the failed login
 */
export declare function getLoginPageWithError(loginPage: string, req: LoginRequest): string;
/** A request that went through {@link bodyParsers}: the bytes the parser read, before parsing */
type BodyRequest = IncomingMessage & {
    body?: unknown;
    rawBody?: Buffer;
};
/** The parsers for form, JSON and text posts that the login and the other authentication routes need */
export declare function bodyParsers(): RequestHandler[];
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
export declare function readBodyAsync(req: BodyRequest, options?: {
    limit?: number;
}): Promise<Buffer>;
export {};
