import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { Buffer } from 'node:buffer';
import { type NextFunction, type Request, type Response } from 'express';
import { Adapter, type AdapterOptions } from '@iobroker/adapter-core';
import type { LocalMultipleLinkEntry, WebAdapterConfig } from './types.d.ts';
export type Server = HttpServer | HttpsServer;
export declare function readBodyAsync(req: IncomingMessage, options?: {
    limit?: number;
}): Promise<Buffer>;
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
    private ownSocket;
    /** If the socket instance is alive */
    private socketioAlive;
    private lang;
    private readonly extensions;
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
     * These six fields are all an app has to report, so they are all that can be created here -
     * and they are created from the definitions below, not from anything the request carries. A
     * client writing a value has no business deciding what an object in the tree looks like.
     */
    private static readonly VIS_STATE;
    constructor(options?: Partial<AdapterOptions>);
    onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void;
    onStateChange(id: string, state: ioBroker.State | null | undefined): void;
    onFileChange(id: string, fileName: string, size: number | null): void;
    onMessage(msg: ioBroker.Message): void;
    onUnload(callback: () => void): void;
    onReady(): Promise<void>;
    updatePreSettings(obj: ioBroker.InstanceObject): void;
    getExtensionsAndSettings(): Promise<ioBroker.InstanceObject[]>;
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
    send404(res: Response, fileName: string, message?: string): void;
    initWebServer(): Promise<void>;
    main(): Promise<void>;
}
