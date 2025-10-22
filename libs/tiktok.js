// /libs/tiktok.js (MODIFIED FOR STREAMING TO BUFFER)

import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';

const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36';

/**
 * Mengubah stream menjadi Buffer.
 * @param {import('stream').Readable} stream 
 * @returns {Promise<Buffer>}
 */
const streamToBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

/**
 * Mengunduh media dari URL dan mengembalikannya sebagai Buffer.
 * @param {string} url 
 * @param {string} referer 
 * @param {CookieJar} cookieJar 
 * @returns {Promise<Buffer>}
 */
async function downloadMediaAsBuffer(url, referer, cookieJar) {
    console.log(`[STREAM] Memulai stream unduhan untuk: ${url.slice(0, 50)}...`);
    const downloadStream = gotScraping.stream(url, {
        headers: { 'Referer': referer, 'Range': 'bytes=0-' },
        cookieJar,
        timeout: { request: 120000 }, // Timeout 2 menit
        retry: { limit: 2 }
    });
    const buffer = await streamToBuffer(downloadStream);
    console.log(`[SUCCESS] Stream berhasil diubah menjadi buffer (${(buffer.length / 1024 / 1024).toFixed(2)} MB).`);
    return buffer;
}

/**
 * Fungsi utama untuk scraping data postingan TikTok.
 * @param {string} tiktokUrl 
 * @returns {Promise<object|null>}
 */
export async function getTikTokPost(tiktokUrl) {
    console.log(`[INFO] Memulai proses untuk URL: ${tiktokUrl}`);

    try {
        const cookieJar = new CookieJar();
        console.log('[STEP 0] Me-resolve URL...');
        const headResponse = await gotScraping.head(tiktokUrl, {
             headers: { 'User-Agent': MOBILE_USER_AGENT },
             cookieJar
        });
        const resolvedUrl = headResponse.url.split('?')[0];
        console.log(`[LOG] URL asli: ${resolvedUrl}`);

        console.log('[STEP 1] Mengambil halaman utama...');
        const response = await gotScraping.get(resolvedUrl, {
            headers: { 'User-Agent': MOBILE_USER_AGENT },
            cookieJar
        });

        console.log('[STEP 2] Mem-parsing HTML dan mencari data JSON...');
        const $ = cheerio.load(response.body);
        let itemStruct;

        // Coba metode mobile dulu, ini yang paling sering berhasil
        const mobileDataScript = $('script#__UNIVERSAL_DATA_FOR_REHYDRATION__');
        if (mobileDataScript.length > 0) {
            const mobileJsonData = JSON.parse(mobileDataScript.html());
            itemStruct = mobileJsonData?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
        } 
        
        // Fallback ke metode desktop jika tidak ditemukan
        if (!itemStruct) {
            const desktopDataScript = $('script#SIGI_STATE');
             if (desktopDataScript.length > 0) {
                const desktopJsonData = JSON.parse(desktopDataScript.html());
                const key = Object.keys(desktopJsonData.ItemModule)[0];
                itemStruct = desktopJsonData.ItemModule[key];
            }
        }

        if (!itemStruct) {
            console.error('[FATAL ERROR] Gagal menemukan data "itemStruct".');
            return null;
        }
        
        console.log('[SUCCESS] Berhasil mengekstrak data "itemStruct".');
        
        const baseMetadata = {
            postId: itemStruct.id,
            author: itemStruct.author.uniqueId,
            description: itemStruct.desc,
            music: itemStruct.music.title,
            stats: itemStruct.stats,
        };

        // --- HANDLE POSTINGAN FOTO/CAROUSEL ---
        if (itemStruct.imagePost && itemStruct.imagePost.images) {
            console.log(`[LOG] Postingan FOTO terdeteksi dengan ${itemStruct.imagePost.images.length} gambar.`);
            const imageUrls = itemStruct.imagePost.images.map(img => img.imageURL.urlList[0]);
            const imageBuffers = [];
            
            for (const url of imageUrls) {
                const buffer = await downloadMediaAsBuffer(url, resolvedUrl, cookieJar);
                imageBuffers.push(buffer);
            }
            return { ...baseMetadata, type: 'Photo', imageBuffers };

        // --- HANDLE POSTINGAN VIDEO ---
        } else if (itemStruct.video && itemStruct.video.playAddr) {
            console.log('[LOG] Postingan VIDEO terdeteksi.');
            const videoUrl = itemStruct.video.playAddr;
            const videoBuffer = await downloadMediaAsBuffer(videoUrl, resolvedUrl, cookieJar);
            return { ...baseMetadata, type: 'Video', videoBuffer };
        } 
        
        console.error('[ERROR] Tipe postingan tidak dikenali.');
        return null;

    } catch (error) {
        console.error(`[FATAL ERROR] Terjadi kesalahan: ${error.message}`);
        if (error.response) console.error(`[DETAILS] Status: ${error.response.statusCode}`);
        return null;
    }
}