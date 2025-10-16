// modules/downloader/ytmp4.js

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, sendVideo, react, delay, fetchAsBufferWithMime } from '../../helper.js';

/**
 * Polling untuk memeriksa status job download di Szyrine API.
 * @param {string} statusUrl URL untuk memeriksa status job.
 * @param {string} apiKey API key Anda.
 * @returns {Promise<object>} Data hasil job yang sudah selesai.
 */
async function pollJobStatus(statusUrl, apiKey) {
    const checkUrl = `${statusUrl}?apikey=${apiKey}`;
    // Coba polling hingga 30 kali (total ~2 menit) sebelum timeout
    for (let i = 0; i < 30; i++) {
        await delay(4000); // Tunggu 4 detik sebelum cek lagi
        try {
            const { data: jobStatus } = await axios.get(checkUrl);

            if (jobStatus.result?.status === 'completed') {
                return jobStatus.result; // Job berhasil, kembalikan hasilnya
            }
            if (jobStatus.result?.status === 'failed' || jobStatus.result?.status === 'error') {
                // Job gagal di server, hentikan polling
                throw new Error(jobStatus.result.message || 'Proses di server gagal.');
            }
            // Jika status masih 'processing' atau lainnya, loop akan berlanjut
        } catch (e) {
            // Jika request ke statusUrl gagal, lempar error
            throw new Error(`Gagal memeriksa status job: ${e.message}`);
        }
    }
    // Jika loop selesai tanpa hasil, berarti timeout
    throw new Error('Waktu pemrosesan habis (timeout). Silakan coba lagi.');
}

export default async function(sock, message, args, query, sender, extras) {
    // Validasi input
    if (!query) {
        return sendMessage(sock, sender, '❌ Format salah. Gunakan `.ytmp4 <link youtube>`', { quoted: message });
    }

    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
    if (!youtubeRegex.test(query)) {
        return sendMessage(sock, sender, '❌ Link YouTube yang Anda berikan tidak valid.', { quoted: message });
    }

    // Validasi API Key
    if (!config.SZYRINE_API_KEY || config.SZYRINE_API_KEY === "YOUR_API_KEY_HERE") {
        console.error("SZYRINE_API_KEY belum diatur di config.js");
        return sendMessage(sock, sender, '❌ API Key belum diatur oleh pemilik bot.');
    }

    try {
        await react(sock, sender, message.key, '⏳');
        await sendMessage(sock, sender, '📥 Permintaan diterima! Memulai proses download video...', { quoted: message });

        // --- TAHAP 1: REQUEST AWAL ---
        const initialUrl = `https://szyrineapi.biz.id/api/youtube/download/mp4?url=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
        const { data: initialResponse } = await axios.get(initialUrl);

        if (initialResponse.status !== 202 || !initialResponse.result?.statusCheckUrl) {
            throw new Error(initialResponse.result?.message || 'Gagal memulai proses download di server.');
        }

        const { statusCheckUrl } = initialResponse.result;

        // --- TAHAP 2: POLLING STATUS ---
        await sendMessage(sock, sender, '🔄 Server sedang memproses video Anda, mohon tunggu...', { quoted: message });
        const completedJob = await pollJobStatus(statusCheckUrl, config.SZYRINE_API_KEY);

        const { title, link: downloadLink } = completedJob.result;

        // --- TAHAP 3: DOWNLOAD & KIRIM ---
        await sendMessage(sock, sender, `✅ Proses selesai! Mengunduh *${title.trim()}*...`, { quoted: message });
        
        // Gunakan fetchAsBufferWithMime yang sudah di-upgrade dengan header penyamaran
        const { buffer } = await fetchAsBufferWithMime(downloadLink);
        
        const caption = `*${title.trim()}*\n\nPowered by Szyrine API`;
        
        await sendVideo(sock, sender, buffer, caption, { quoted: message });
        await react(sock, sender, message.key, '✅');

    } catch (error) {
        console.error(`[Ytmp4 Error]`, error);
        await sendMessage(sock, sender, `❌ Terjadi kesalahan: ${error.message}`, { quoted: message });
        await react(sock, sender, message.key, '❌');
    }
}

// Alias untuk command
export const aliases = ['ytv', 'youtubevideo'];
export const category = 'Downloaders';
export const description = 'Mengunduh video dari YouTube sebagai MP4.';
export const usage = `${config.BOT_PREFIX}ytmp4 <url>`; // Usage disederhanakan