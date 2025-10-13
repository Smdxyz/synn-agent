// lib/og-downloader.js
// Versi upgrade yang menggunakan got-scraping untuk melewati anti-bot (misal: Cloudflare)

import { got } from 'got-scraping'; // <-- GANTI AXIOS DENGAN INI
import { randomBytes } from 'crypto';

// --- Konfigurasi & Fungsi Bawaan ---
// Kita tetap pakai header yang lebih sederhana, karena got-scraping sudah handle sisanya.
const HEADERS = {
    'accept': '*/*',
    'accept-language': 'id-ID,id;q=0.9',
    'content-type': 'application/json',
    'origin': 'https://ogmp3.pro',
    'referer': 'https://ogmp3.pro/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

function ranHash() {
    return randomBytes(16).toString('hex');
}

function encodeDecode(url) {
    let result = '';
    for (let i = 0; i < url.length; i++) {
        result += String.fromCharCode(url.charCodeAt(i) ^ 1);
    }
    return result;
}

function encUrl(url) {
    const charCodes = [];
    for (let i = 0; i < url.length; i++) {
        charCodes.push(url.charCodeAt(i));
    }
    return charCodes.reverse().join(',');
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fungsi utama untuk mendapatkan link download dari ogmp3.
 * @param {string} youtubeUrl - URL video YouTube.
 * @param {object} options - Opsi konversi.
 * @param {'mp3'|'mp4'} options.format - Format yang diinginkan.
 * @param {function(string, number, number): Promise<void>} [options.onProgress] - Callback untuk update progress.
 */
export async function getDownloadLink(youtubeUrl, options = {}) {
    const { format = 'mp3', onProgress } = options;
    const formatId = format === 'mp4' ? '1' : '0';
    const apiSubdomain = format === 'mp4' ? 'api5' : 'api3';
    const apiEndpoint = `https://${apiSubdomain}.apiapi.lat`;

    // 1. === Memulai Konversi ===
    if (onProgress) await onProgress('Memulai konversi...', 0, 0);
    const initPayload = {
        data: encodeDecode(youtubeUrl),
        format: formatId,
        referer: 'https://www.google.com/',
        mp3Quality: '320',
        mp4Quality: '720',
        userTimeZone: (new Date().getTimezoneOffset()).toString(),
    };
    const initUrl = `${apiEndpoint}/${ranHash()}/init/${encUrl(youtubeUrl)}/${ranHash()}/`;
    
    // ================== PERUBAHAN UTAMA DI SINI ==================
    const { body: initResponse } = await got.post(initUrl, {
        json: initPayload, // <-- `got` menggunakan properti `json`
        headers: { ...HEADERS, authority: `${apiSubdomain}.apiapi.lat` },
    }).catch(e => {
        // `got` melempar error yang lebih deskriptif
        throw new Error(`Gagal menghubungi server: ${e.message}`);
    });
    // =============================================================

    if (!initResponse.i || initResponse.s === 'E' || initResponse.i === 'invalid') {
        let reason = 'Respons server tidak valid.';
        if (initResponse.le) reason = 'Video terlalu panjang untuk diproses.';
        throw new Error(`Gagal memulai konversi. ${reason}`);
    }

    const uniqueId = initResponse.i;
    const pk = initResponse.pk;

    // 2. === Polling Status ===
    const maxRetries = 40;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await delay(3500);

        const statusUrl = `${apiEndpoint}/${ranHash()}/status/${uniqueId}/${ranHash()}/${pk}/`;
        
        // ================== PERUBAHAN UTAMA DI SINI ==================
        const { body: statusResponse } = await got.post(statusUrl, {
            json: { data: uniqueId }, // <-- `got` menggunakan properti `json`
            headers: { ...HEADERS, authority: `${apiSubdomain}.apiapi.lat` },
        }).catch(() => ({ body: { s: 'P' } })); // <-- Jika error, anggap masih proses
        // =============================================================

        if (statusResponse.s === 'C') {
            if (onProgress) await onProgress('Konversi selesai!', attempt, maxRetries);
            const downloadUrl = `${apiEndpoint}/${ranHash()}/download/${uniqueId}/${ranHash()}/${pk}/`;
            return { title: statusResponse.t, downloadUrl };
        } else if (statusResponse.s === 'P') {
             if (onProgress) await onProgress('Sedang memproses...', attempt, maxRetries);
        } else {
            throw new Error(`Menerima status tidak terduga dari server: ${JSON.stringify(statusResponse)}`);
        }
    }
    
    throw new Error('Waktu pemrosesan habis (timeout). Server terlalu lama merespons.');
}