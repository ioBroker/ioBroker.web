import type { Request, Response } from 'express';
/**
 * Send the content of a file, compressed if the client accepts it, and `304 Not Modified` if the client has it.
 *
 * @param req the request
 * @param res the response
 * @param file the content of the file
 * @param mimeType the type of the content
 * @param cacheControl the value of the `Cache-Control` header
 */
export declare function sendFile(req: Request, res: Response, file: Buffer | string, mimeType: string, cacheControl: string): Promise<void>;
