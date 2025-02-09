import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { type NextFunction, type Request, type Response } from 'express';
import { Adapter, type AdapterOptions } from '@iobroker/adapter-core';
export type Server = HttpServer | HttpsServer;
export declare class WebAdapter extends Adapter {
    private indexHtml;
    private webConfig;
    private checkTimeout;
    private vendorPrefix;
    private webServer;
    private store;
    private secret;
    private socketUrl;
    private readonly cache;
    private ownSocket;
    private lang;
    private readonly extensions;
    private readonly bruteForce;
    private socketIoFile;
    private readonly webPreSettings;
    private readonly webByVersion;
    private loginPage;
    private ownGroups;
    private ownUsers;
    constructor(options?: Partial<AdapterOptions>);
    onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void;
    onStateChange(id: string, state: ioBroker.State | null | undefined): void;
    onFileChange(id: string, fileName: string, size: number | null): void;
    onMessage(msg: ioBroker.Message): void;
    onUnload(callback: () => void): void;
    onReady(): Promise<void>;
    updatePreSettings(obj: ioBroker.InstanceObject): void;
    getExtensionsAndSettings(): Promise<ioBroker.InstanceObject[]>;
    getListOfAllAdapters(req: Request): Promise<string>;
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
    prepareLoginTemplate(): string;
    checkUser: (userName: string | undefined, password: string | undefined, cb: (err: Error | null, userName?: string | false) => void) => void;
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
    isInWhiteList(req: Request): string;
    getFoldersOfObject(path: string | undefined): Promise<string[]>;
    processReadFolders(req: Request, res: Response): Promise<void>;
    getSocketUrl(obj?: ioBroker.InstanceObject): Promise<void>;
    initWebServer(): Promise<void>;
    main(): Promise<void>;
}
