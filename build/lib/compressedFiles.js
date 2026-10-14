"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFile = sendFile;
const node_crypto_1 = require("node:crypto");
const node_zlib_1 = require("node:zlib");
/**
 * The compressed form of the files this server sends, kept so that every file is compressed once.
 *
 * `compression()` compresses every answer anew. That is cheap for a page of some kilobytes, but a single page of
 * an app of today loads several megabytes of scripts: measured on a desktop, a chunk of 1.8 MB is read from the
 * file storage in 7 ms and compressed in 100 ms - on every load, by every client. On a Raspberry Pi that is
 * seconds of CPU for one cold page load, and since it happens in the single process of the web server, every
 * other request queues behind it.
 *
 * The key is the content itself (its ETag), so a changed file can never be answered with an old compressed form,
 * and the compression runs in the thread pool of zlib instead of blocking the event loop.
 */
/** Below this size compressing does not pay - the same threshold `compression()` uses */
const MIN_SIZE = 1024;
/** Larger files are still compressed, but not kept */
const MAX_ENTRY_SIZE = 8 * 1024 * 1024;
/** Upper limit of all kept compressed files together */
const MAX_TOTAL_SIZE = 64 * 1024 * 1024;
const COMPRESSIBLE = /^(text\/|application\/(javascript|ecmascript|json|xml|manifest\+json|.*\+json|.*\+xml)|image\/svg\+xml)/;
/** The kept files, the least recently used first. A pending entry is a compression still running */
const cache = new Map();
let totalSize = 0;
/**
 * The ETag `express` gives a body - the same value, so that what browsers already hold stays valid
 *
 * @param body the uncompressed content
 */
function computeEtag(body) {
    if (!body.length) {
        return 'W/"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
    }
    const hash = (0, node_crypto_1.createHash)('sha1').update(body).digest('base64').substring(0, 27);
    return `W/"${body.length.toString(16)}-${hash}"`;
}
function compress(body, encoding) {
    return new Promise((resolve, reject) => {
        const done = (error, result) => (error ? reject(error) : resolve(result));
        if (encoding === 'br') {
            (0, node_zlib_1.brotliCompress)(body, {
                params: {
                    [node_zlib_1.constants.BROTLI_PARAM_QUALITY]: 5,
                    [node_zlib_1.constants.BROTLI_PARAM_SIZE_HINT]: body.length,
                    [node_zlib_1.constants.BROTLI_PARAM_MODE]: node_zlib_1.constants.BROTLI_MODE_TEXT,
                },
            }, done);
        }
        else {
            (0, node_zlib_1.gzip)(body, { level: 6 }, done);
        }
    });
}
function getCompressed(body, etag, encoding) {
    if (body.length > MAX_ENTRY_SIZE) {
        return compress(body, encoding);
    }
    const key = `${encoding}:${etag}`;
    const entry = cache.get(key);
    if (entry) {
        // most recently used goes to the end
        cache.delete(key);
        cache.set(key, entry);
        return entry.data;
    }
    const data = compress(body, encoding);
    const newEntry = { data, size: 0 };
    cache.set(key, newEntry);
    data.then(result => {
        if (cache.get(key) !== newEntry) {
            return;
        }
        newEntry.size = result.length;
        totalSize += result.length;
        for (const [oldKey, oldEntry] of cache) {
            if (totalSize <= MAX_TOTAL_SIZE) {
                break;
            }
            cache.delete(oldKey);
            totalSize -= oldEntry.size;
        }
    }, () => cache.delete(key));
    return data;
}
/**
 * Send the content of a file, compressed if the client accepts it, and `304 Not Modified` if the client has it.
 *
 * @param req the request
 * @param res the response
 * @param file the content of the file
 * @param mimeType the type of the content
 * @param cacheControl the value of the `Cache-Control` header
 */
async function sendFile(req, res, file, mimeType, cacheControl) {
    const body = Buffer.isBuffer(file) ? file : Buffer.from(file);
    const etag = computeEtag(body);
    res.contentType(mimeType);
    res.set('Cache-Control', cacheControl);
    res.set('ETag', etag);
    res.vary('Accept-Encoding');
    if (req.fresh) {
        res.status(304).end();
        return;
    }
    const accepted = req.acceptsEncodings('br', 'gzip');
    const encoding = accepted === 'br' || accepted === 'gzip' ? accepted : null;
    if (!encoding || body.length < MIN_SIZE || !COMPRESSIBLE.test(res.get('Content-Type') || '')) {
        res.status(200).send(body);
        return;
    }
    let compressed;
    try {
        compressed = await getCompressed(body, etag, encoding);
    }
    catch {
        // `compression()` gets the chance then
        res.status(200).send(body);
        return;
    }
    // with this header `compression()` leaves the answer alone
    res.set('Content-Encoding', encoding);
    res.status(200).send(compressed);
}
//# sourceMappingURL=compressedFiles.js.map