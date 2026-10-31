declare module 'on-headers' {
    function onHeaders(response: object, listener: (this: object) => void): void;

    export = onHeaders;
}
