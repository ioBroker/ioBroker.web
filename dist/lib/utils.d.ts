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
