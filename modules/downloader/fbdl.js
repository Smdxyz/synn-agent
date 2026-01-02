// /modules/downloader/fbdl.js (BARU)

import { config } from '../../config.js';
import { sendMessage } from '../../helper.js';
import { handleApiDownloader } from '../../libs/downloaderHandler.js';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh video atau reels dari Facebook.';
export const usage = `${config.BOT_PREFIX}fbdl <url>`;
export const aliases = ['fb', 'facebook', 'facebookdl'];

/**
 * Mengonversi link fb.com/share menjadi link reels/video asli.
 * API Szyrine tidak bisa handle link /share, jadi kita bantu di sini.
 * @param {string} url URL Facebook
 * @returns {Promise<string>} URL yang sudah diconvert atau URL asli jika gagal.
 */
async function resolveFacebookShareLink(url) {
    if (url.includes('/share/')) {
        try {
            // Kita pakai axios dengan maxRedirects: 0 untuk "mencuri" header 'location'
            const response = await axios.get(url, { maxRedirects: 0, validateStatus: status => status >= 200 && status < 400 });
            // Header 'location' berisi URL asli yang kita butuhkan
            if (response.headers.location) {
                return response.headers.location;
            }
        } catch (error) {
            // Jika redirect gagal, kemungkinan URL asli ada di error response
            if (error.response && error.response.headers.location) {
                return error.response.headers.location;
            }
            console.error("Gagal me-resolve link Facebook Share:", error.message);
        }
    }
    return url; // Kembalikan URL asli jika bukan link /share atau jika gagal
}

// --- FUNGSI UTAMA ---
export default async function fbdl(sock, msg, args, query, sender) {
    const url = query;

    if (!url || !/(?:https?:\/\/)?(?:www\.|m\.|web\.)?facebook\.com\//.test(url)) {
        return sendMessage(sock, sender, `Silakan berikan link Facebook yang valid.\n\n*Contoh:*\n\`${usage}\``, { quoted: msg });
    }

    await handleApiDownloader(sock, msg, url, {
        platformName: 'Facebook',
        apiUrl: 'https://szyrineapi.biz.id/api/dl/facebook',
        urlPreProcessor: resolveFacebookShareLink, // <-- Ini fungsi untuk handle link /share
        captionFormatter: (result) => {
            return result.title || result.description || `Video dari Facebook`;
        }
    });
}

export const cost = 5;
