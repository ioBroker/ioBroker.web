export interface LocalLinkEntry {
    id?: `system.adapter.${string}.${number}`;
    instance?: number;
    localLink: string;
    name?: ioBroker.StringOrTranslated;
    pro: boolean;
    color?: string;
    img?: string;
    order?: number;
}

export interface LocalMultipleLinkEntry extends LocalLinkEntry {
    localLink: string | { [instance: string]: string };
}

declare class ExtAPI {
    public waitForReadyTime?: number;

    constructor(
        webServer: Server,
        settings: {
            secure: boolean;
            port: number | string;
            defaultUser?: string;
            auth?: boolean;
            language?: ioBroker.Languages;
        },
        adapter: ioBroker.Adapter,
        config: ioBroker.InstanceObject,
        app?: Express,
        io?: SocketIO,
    );

    welcomePage?(): LocalMultipleLinkEntry;
    fileChange?(id: string, fileName: string, size: number | null): void;
    stateChange?(id: string, state: ioBroker.State | null | undefined): void;
    objectChange?(id: string, state: ioBroker.Object | null | undefined): void;
    /** Give to the extension up to 5 seconds to be loaded */
    waitForReady?(onReady: () => void): void;
    unload?(): Promise<void>;
}

export interface WhiteListSettings {
    /** Like "admin" or "user". No "system.user." prefix */
    user: string;
    object: {
        read: boolean;
        list: boolean;
        write: boolean;
        delete: boolean;
    };
    state: {
        read: boolean;
        list: boolean;
        write: boolean;
        create: boolean;
        delete: boolean;
    };
    file: {
        read: boolean;
        list: boolean;
        write: boolean;
        create: boolean;
        delete: boolean;
    };
}

export interface WebAdapterConfig {
    addUserName: boolean;
    auth: boolean;
    basicAuth: boolean;
    bind: string;
    cache: boolean;
    certChained: string;
    certPrivate: string;
    certPublic: string;
    compatibilityV2: boolean;
    defaultRedirect: string;
    defaultUser: string; // without 'system.user.'
    disableExtensions: boolean;
    disableFilesObjects: boolean;
    disableStates: boolean;
    doNotCheckPublicIP: boolean;
    forceWebSockets: boolean;
    language: ioBroker.Languages;
    loadingBackgroundColor: string;
    loadingBackgroundImage: boolean;
    loadingHideLogo: boolean;
    loginBackgroundColor: string;
    loginBackgroundImage: boolean;
    loginNoOauth2: boolean;
    port: number | string;
    secure: boolean;
    showFolderIndex: boolean;
    socketio: `system.adapter.${string}.${number}` | '';
    startDisabledExtensions: boolean;
    staticAssetCacheMaxAge: number | string;
    ttl: number | string;
    usePureWebSockets: boolean;
    userListEnabled: boolean;
    userListSettings: {
        users: `system.user.${string}`[];
        accessAsUser: `system.user.${string}`;
        groups: `system.group.${string}`[];
    };
    whiteListEnabled: boolean;
    whiteListSettings?: Record<string, WhiteListSettings>;
}
