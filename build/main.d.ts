import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { Buffer } from 'node:buffer';
import { type NextFunction, type Request, type Response } from 'express';
import { Adapter, type AdapterOptions } from '@iobroker/adapter-core';
import type { LocalMultipleLinkEntry, WebAdapterConfig } from './types.d.ts';
export type Server = HttpServer | HttpsServer;
export declare class WebAdapter extends Adapter {
    config: WebAdapterConfig;
    private indexHtml;
    private checkTimeout;
    private vendorPrefix;
    private webServer;
    private store;
    private secret;
    private socketUrl;
    private readonly cache;
    /** Namespaces whose files are in {@link cache} and are therefore watched for changes */
    private readonly cachedNamespaces;
    private ownSocket;
    /** If the socket instance is alive */
    private socketioAlive;
    private lang;
    private readonly extensions;
    /**
     * The subscriptions of web, its socket server and the extensions: one of them giving up a pattern does
     * not take it away from the others (`lib/subscriptions.ts`)
     */
    private readonly subscriptions;
    /** The routers of the running extensions. Dropping one takes all routes of its extension back */
    private readonly extensionRouters;
    /** The classes of the extensions this process loaded, by adapter name, with the code they came from */
    private readonly extensionClasses;
    /** Instances whose object changed, waiting for the changes to settle */
    private readonly pendingExtensionChanges;
    /** Extensions are started and stopped one after the other */
    private extensionQueue;
    /** Set when web restarts to load an extension, so that it restarts once */
    private restartingForExtension;
    /** Set when web stops: from then on no extension is started or stopped on its own */
    private stoppingWeb;
    /** Paths the extensions answer themselves, without the authentication of web (`ExtAPI.publicRoutes`) */
    private readonly publicRoutes;
    private readonly bruteForce;
    private socketIoFile;
    private readonly webPreSettings;
    private readonly webByVersion;
    private loginPage;
    private ownGroups;
    private ownUsers;
    private templateDir;
    private template404;
    /** Devices of a visu app whose objects were checked once - see applyRemoteCommand(). */
    private readonly checkedRemoteDevices;
    /**
     * The one id a visu app posts its telemetry to: `cloud.<X>.remote.command`.
     *
     * Everything else is written as it is asked for - this is the only id whose content is taken
     * apart, and the only one that is created without the request saying how. Naming the adapter
     * keeps it that way: no other `<something>.<X>.remote.command` falls into this branch.
     */
    private static readonly REMOTE_COMMAND;
    /**
     * The states a visu app reports into, when it stores its values in `vis.<X>` rather than
     * through the cloud adapter: `vis.<X>.<device>.<field>`.
     *
     * These seven fields are all an app has to report, so they are all that can be created here -
     * and they are created from the definitions below, not from anything the request carries. A
     * client writing a value has no business deciding what an object in the tree looks like.
     */
    /** The name `alive` carried before it meant "the device still reports". */
    private static readonly OUTDATED_ALIVE_NAME;
    private static readonly VIS_STATE;
    constructor(options?: Partial<AdapterOptions>);
    onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void;
    onStateChange(id: string, state: ioBroker.State | null | undefined): void;
    /**
     * Put a file into the cache and watch the adapter it belongs to
     *
     * The cache has no lifetime of its own, so without watching, a file that is written again under
     * the same name is served from the first read until the instance restarts. `sayit` is the case
     * that shows it: it writes every announcement to the same name, and with the cache enabled the
     * browser kept getting the first one. Only the namespaces that really end up in the cache are
     * watched, so enabling the cache does not subscribe to the files of the whole system.
     *
     * @param id - namespace the file belongs to, e.g. `sayit.0`
     * @param url - path of the file inside that namespace
     * @param entry - the file and its type
     * @param entry.mimeType - content type to answer with
     * @param entry.buffer - contents of the file
     */
    private cacheFile;
    onFileChange(id: string, fileName: string, size: number | null): void;
    onMessage(msg: ioBroker.Message): void;
    onUnload(callback: () => void): void;
    onReady(): Promise<void>;
    updatePreSettings(obj: ioBroker.InstanceObject): void;
    getExtensionsAndSettings(): Promise<ioBroker.InstanceObject[]>;
    /**
     * Whether an instance runs as a web extension of this web instance: it has one, names this web instance
     * or all of them, and is enabled - or runs although it is disabled, started by hand for instance.
     *
     * @param obj the instance object
     */
    private isExtensionOfThisInstance;
    /**
     * The instance object as the extension gets it: a copy with the native attributes listed in
     * `encryptedNative` decrypted
     *
     * @param obj the instance object as it was read
     */
    private prepareExtensionConfig;
    /**
     * The class of an extension. Loaded once per adapter and kept: a new object of an extension whose
     * settings changed is made from the same class.
     *
     * @param instance the extension instance, e.g. `cameras.0`
     */
    private loadExtensionClass;
    /**
     * Start one extension: it gets a router of its own, and everything it adds to the server and to this
     * adapter while it is constructed is noted, to be removed when it stops.
     *
     * @param instance the extension instance, e.g. `cameras.0`; its entry in {@link extensions} must exist
     * @returns a promise that resolves when the extension is ready, if it says when (`waitForReady`)
     */
    private startExtension;
    /**
     * Stop one extension while web keeps running: its routes and public paths go first, so no new request
     * reaches it, then it unloads itself. Listeners it added while it was constructed and did not remove
     * are removed afterwards.
     *
     * @param instance the extension instance, e.g. `cameras.0`
     */
    private stopExtension;
    /**
     * Wait for the object of an extension instance to settle - an upload or a save writes it several times
     * in a row - and then start, stop or restart the extension
     *
     * @param instance the extension instance, e.g. `cameras.0`
     */
    private scheduleExtensionChange;
    /**
     * Bring an extension in line with its instance object. It is started when it now belongs to this web
     * instance and stopped when it no longer does. With other settings, it is stopped and started again -
     * if it supports that (`supportsHotReload`). Otherwise, and for a new version of its code, web restarts.
     *
     * @param instance the extension instance, e.g. `cameras.0`
     */
    private applyExtensionChange;
    /**
     * Restart web to load an extension that cannot be loaded into the running process
     *
     * @param reason what is logged
     */
    private restartForExtension;
    /**
     * Whether this instance is served by this web instance as a web extension
     *
     * Such an instance does not listen on a port of its own: it is mounted into this server under a
     * path the extension picks itself. A link built from its own `native.port` - which is what
     * `common.localLinks` of most adapters describes - therefore points at nothing. The entry the
     * extension returns from `welcomePage()` is used instead.
     *
     * @param instance - the instance object to check
     */
    private isOwnWebExtension;
    getListOfAllAdapters(remoteIp: string): Promise<{
        systemLang: ioBroker.Languages;
        showAdminInstances: boolean;
        authEnabled: boolean;
        list: LocalMultipleLinkEntry[];
    }>;
    getIndexHtml(req: Request): Promise<string>;
    /**
     * Transform a pattern like %protocol%://%web.0_bind%:%port into https://192.168.1.1:8081
     *
     * @param link Pattern
     * @param instanceObj Current instance object
     * @param instancesMap All instances
     */
    resolveLink(link: string, instanceObj: ioBroker.InstanceObject | undefined, instancesMap: Record<string, ioBroker.InstanceObject>): string | {
        [instance: `${string}.${number}`]: string;
    };
    getSocketPath(): string;
    getInfoJs(): string;
    checkUser: (userName: string | undefined, password: string | undefined, cb: (err: Error | null, result?: {
        logged_in: boolean;
        user?: string;
    }) => void) => void;
    private getUserListUser;
    /**
     * Configuration of the identity provider for the single sign-on, or undefined if it is not offered.
     *
     * Not together with the user list: its "access web interface as" would put another user into the
     * token, and the token is valid for admin and every other adapter too. The single sign-on stays off
     * then, and not the user list, so that a configuration with both never lets in more users than before.
     */
    private getOidcConfig;
    initAuth(): void;
    /**
     * Externally reachable base URL, without a trailing slash. Behind a reverse proxy the
     * request-derived value is wrong, which is what the `publicUrl` setting is for.
     *
     * @param req - request object
     */
    private getPublicBaseUrl;
    /**
     * Build the `WWW-Authenticate` challenge for an unauthenticated API request.
     *
     * The `resource_metadata` link is what lets a client discover the authorization server on its
     * own (RFC 9728). Its path is derived from the requested resource, so a request to `/mcp` is
     * pointed at `/.well-known/oauth-protected-resource/mcp` — the document that the web extension
     * owning that path publishes. When no such document exists, clients fall back to the server-wide
     * metadata at the origin root.
     *
     * @param req - request object
     * @param url - requested path without the query string
     */
    private buildBearerChallenge;
    /**
     * Send response to a byte ranges request
     *
     * @param req - request object
     * @param res - response object
     * @param buffer - buffer to be sent
     */
    sendRange(req: Request, res: Response, buffer: Buffer): void;
    getSocketIoFile(req: Request, res: Response, next: NextFunction | true): void;
    isInWhiteList(req: Request | string): string;
    getFoldersOfObject(path: string | undefined): Promise<string[]>;
    processReadFolders(req: Request, res: Response): Promise<void>;
    getSocketUrl(obj?: ioBroker.InstanceObject, state?: ioBroker.State | null): Promise<void>;
    modifyIndexHtml(html: string): Promise<string>;
    /**
     * Turns the command a visu app writes into states of its own - the job the cloud adapter does
     * in its own `onStateChange`.
     *
     * The app posts one line into `cloud.X.remote.command`:
     * `{"value": "42", "deviceName": "tablet", "name": "batteryLevel"}`, and the cloud adapter
     * makes `cloud.X.devices.tablet.batteryLevel` out of it. An installation that has the adapter
     * stopped - or only installed for the remote access it is not using at the moment - reported
     * nothing at all, although the value had arrived here. It is done here instead when the
     * adapter is not running, so the app does not depend on it.
     *
     * Nothing happens for any other state, and nothing happens while the adapter itself runs:
     * both writing the same states would only be a race for the same values.
     *
     * @param stateName the state that was just written
     * @param value what was written into it
     * @param user the user the request is running as
     */
    private applyRemoteCommand;
    /**
     * The definition of one state a visu app reports into, or null when the id is not one of
     * them. The device name is read out of the id, so the states read like the ones the app
     * created itself before.
     *
     * @param id the full state id, e.g. `vis.0.tablet.battery.level`
     */
    private static visStateCommon;
    /**
     * Creates the state a visu app reports into, together with the device it belongs to, so the
     * values show up as one device with an online indicator rather than as loose ids.
     *
     * @param stateId the state to create, already known to be one of [VIS_STATE]
     * @param common its definition
     * @param user the user the request is running as
     */
    private createVisState;
    /** The definition of one reported value, as the cloud adapter creates it. */
    private static remoteStateCommon;
    /**
     * Protect a callback the session store calls
     *
     * The store answers from a task of its own, so by the time it calls back, the call stack of the
     * request is gone: an exception thrown in such a callback passes no `try/catch` and never reaches
     * the error handling of express, and the controller answers an uncaught exception by terminating
     * the instance. A single unexpected session would take the whole web server down with it, along
     * with every web extension and everybody else's connection, which is why the callbacks are
     * guarded here instead of trusting what a session contains.
     *
     * @param what - what the callback was doing, for the log line
     * @param res - response to end with a 500 if the callback did not answer yet, if there is one
     * @param cb - the callback to protect
     */
    private guardStoreCallback;
    send404(res: Response, fileName: string, message?: string): void;
    initWebServer(): Promise<void>;
    main(): Promise<void>;
}
