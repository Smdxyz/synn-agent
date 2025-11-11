// libs/utils.js

import got from 'got';
import { Readable } from 'stream';
import { createReadStream } from 'fs';

/**
 * Mengubah bytes menjadi format yang lebih mudah dibaca (KB, MB, GB).
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Menjeda eksekusi selama beberapa milidetik.
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mengambil stream dari berbagai sumber (Buffer, URL, path file).
 * Penting untuk fungsi media di helper.js.
 */
export async function getStream(item) {
    if (Buffer.isBuffer(item)) {
        const readable = new Readable({ read() {} });
        readable.push(item);
        readable.push(null);
        return { stream: readable, type: 'buffer' };
    }

    if (item?.url) {
        const urlStr = item.url.toString();
        if (urlStr.startsWith('http')) {
            return { stream: got.stream(urlStr), type: 'remote' };
        } else {
            return { stream: createReadStream(urlStr), type: 'file' };
        }
    }
    
    throw new Error('Invalid item for getStream');
}

/**
 * Mengubah stream menjadi Buffer.
 */
export async function toBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    stream.destroy();
    return Buffer.concat(chunks);
}