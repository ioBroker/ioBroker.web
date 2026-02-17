import { IncomingMessage, type Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { type NextFunction, type Request, type Response } from 'express';
import { Adapter, type AdapterOptions } from '@iobroker/adapter-core';
import type { LocalMultipleLinkEntry, WebAdapterConfig } from './types.d.ts';
import { Buffer } from 'buffer';
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
    /** If socket instance is alive */
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
    private I18n;
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
     * Transform pattern like %protocol%://%web.0_bind%:%port into https://192.168.1.1:8081
     *
     * @param link Pattern
     * @param instanceObj Current instance object
     * @param instancesMap All instances
     */
    resolveLink(link: string, instanceObj: ioBroker.InstanceObject | undefined, instancesMap: Record<string, ioBroker.InstanceObject>): string | {
        [instance: `${string}.${number}`]: string;
    };
    getInfoJs(): string;
    checkUser: (userName: string | undefined, password: string | undefined, cb: (err: Error | null, result?: {
        logged_in: boolean;
        user?: string;
    }) => void) => void;
    initAuth(): void;
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
    send404(res: Response, fileName: string, message?: string): void;
    initWebServer(): Promise<void>;
    main(): Promise<void>;
}
