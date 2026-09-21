import type { WebAdapterConfig } from '../types';

/** What the ioBroker.visu app needs, as far as it is read from other instances */
export interface VisuPayload {
    /** Base64 of the `iotConfig|...` line the app scans */
    payload: string;
    /** Instance the credentials come from, like `cloud.0`, empty without one */
    source: string;
}

/** The parts of an AdminConnection this module uses, so it can be tested with a stub */
export interface VisuSocket {
    getAdapterInstances: (adapter: string) => Promise<ioBroker.InstanceObject[]>;
    getObject: (id: string) => Promise<ioBroker.Object | null | undefined>;
    getState: (id: string) => Promise<ioBroker.State | null | undefined>;
    decrypt: (value: string) => Promise<string>;
    sendTo: (instance: string, command: string, data: any) => Promise<any>;
}

interface NetworkInterface {
    family: string;
    internal: boolean;
    address: string;
    netmask: string;
}

/** Configuration of a cloud or iot instance, as far as the credentials are concerned */
interface CloudConfig {
    login?: string;
    pass?: string;
    credentialType?: 'manual' | 'manager';
    credentialId?: string;
}

/**
 * Base64 of a text that may contain characters beyond latin1 - `btoa` alone throws on those.
 *
 * @param text the text to encode
 */
export function toBase64(text: string): string {
    let binary = '';
    new TextEncoder().encode(text).forEach(byte => (binary += String.fromCharCode(byte)));
    return btoa(binary);
}

/** The first enabled instance of that adapter, or the first one at all */
async function findInstance(socket: VisuSocket, adapter: string): Promise<ioBroker.InstanceObject | null> {
    const instances = await socket.getAdapterInstances(adapter);
    return instances?.find(instance => instance.common.enabled) || instances?.[0] || null;
}

/**
 * Addresses of this server as `<ip>/<netmask>`, which is how the app searches the local network.
 *
 * Bound to all addresses, every external IPv4 address of the host is listed - the app tries them in turn.
 *
 * @param socket connection to the admin
 * @param bind the address this instance is bound to
 * @param host host this instance runs on, like `raspberrypi`
 */
export async function getAddresses(socket: VisuSocket, bind: string, host: string): Promise<string[]> {
    if (bind !== '0.0.0.0') {
        return bind ? [bind] : [];
    }

    const addresses: string[] = [];
    const hostConfig = await socket.getObject(`system.host.${host}`);
    const interfaces = hostConfig?.native?.hardware?.networkInterfaces as
        Record<string, NetworkInterface[]> | undefined;
    if (interfaces) {
        Object.keys(interfaces).forEach(name =>
            interfaces[name]?.forEach(iface => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    addresses.push(`${iface.address}/${iface.netmask}`);
                }
            }),
        );
    }
    return addresses;
}

/**
 * Ask a running cloud instance for the finished payload.
 *
 * A password kept in the credential manager lives outside the instance configuration and only that instance
 * may read it, so it builds the payload itself. `sendTo` reaches a running instance only, hence the check.
 *
 * @param socket connection to the admin
 * @param id instance to ask, like `cloud.0`
 * @param webInstance this web instance, like `web.0`, which the cloud instance reads the connection from
 * @param credentialId the credential the cloud instance is configured with
 */
async function askCloud(socket: VisuSocket, id: string, webInstance: string, credentialId?: string): Promise<string> {
    const alive = await socket.getState(`${id}.alive`);
    if (!alive?.val) {
        return '';
    }
    try {
        const result = await socket.sendTo(id, 'qrCode', {
            instance: webInstance,
            credentialType: 'manager',
            credentialId,
        });
        // An error comes back as `{ error: '...' }`, the payload as a plain string
        return typeof result === 'string' ? result : '';
    } catch (e) {
        console.warn(`Cannot read the QR code from ${id}: ${e as Error}`);
        return '';
    }
}

/**
 * The ioBroker.pro credentials the app signs in with, from the first cloud or iot instance.
 *
 * `payload` is set when the cloud instance built the whole line itself.
 *
 * @param socket connection to the admin
 * @param webInstance this web instance, like `web.0`
 */
async function readCredentials(
    socket: VisuSocket,
    webInstance: string,
): Promise<{ login: string; password: string; source: string; payload?: string } | null> {
    for (const adapter of ['cloud', 'iot']) {
        const instance = await findInstance(socket, adapter);
        if (!instance) {
            continue;
        }
        const source = instance._id.replace('system.adapter.', '');
        const native: CloudConfig = instance.native || {};

        if (adapter === 'cloud' && native.credentialType === 'manager') {
            const payload = await askCloud(socket, source, webInstance, native.credentialId);
            if (payload) {
                return { login: '', password: '', source, payload };
            }
        } else if (native.login && native.pass) {
            return { login: native.login, password: await socket.decrypt(native.pass), source };
        }
    }
    return null;
}

/**
 * Everything the ioBroker.visu app needs to reach this web instance.
 *
 * The line carries the addresses and the port for the local network, and the ioBroker.pro credentials of a
 * cloud or iot instance for the access from outside. Without such an instance the credentials stay empty and
 * the app only reaches this server in the local network.
 *
 * @param socket connection to the admin
 * @param native configuration of this web instance
 * @param instance number of this web instance
 * @param host host this instance runs on, like `raspberrypi`
 */
export async function buildVisuPayload(
    socket: VisuSocket,
    native: WebAdapterConfig,
    instance: number,
    host: string,
): Promise<VisuPayload> {
    const credentials = await readCredentials(socket, `web.${instance}`);
    if (credentials?.payload) {
        return { payload: credentials.payload, source: credentials.source };
    }

    const addresses = await getAddresses(socket, native.bind, host);
    const text =
        `iotConfig|port:${native.port}|ips:${addresses.join(',')}|cu:${credentials?.login || ''}` +
        `|cp:${credentials?.password || ''}|https:${!!native.secure}|auth:${!!native.auth}`;

    return { payload: toBase64(text), source: credentials?.source || '' };
}
