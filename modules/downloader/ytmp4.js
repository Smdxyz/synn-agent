// modules/downloader/ytmp4.js (FIXED)

import got from 'got';
import { config } from '../../config.js';
import { sendMessage, sendVideo, react, delay, fetchAsBufferWithMime } from '../../helper.js';

/**
 * Polling untuk memeriksa status job download di Szyrine API menggunakan 'got'.
 */
async function pollJobStatus(statusUrl) {
    // API Key sudah termasuk di statusCheckUrl dari respons pertama
    for (let i = 0; i < 30; i++) {
        await delay(4000);
        try {
            const jobStatus = await got(statusUrl).json();

            if (jobStatus.result?.status === 'completed') {
                return jobStatus.result;
            }
            if (jobStatus.result?.status === 'failed' || jobStatus.result?.status === 'error') {
                throw new Error(jobStatus.result.message || 'Proses di server gagal.');
            }
        } catch (e) {
            // Jangan throw error jika hanya gagal polling sekali, coba lagi
        }
    }
    throw new Error('Waktu pemrosesan habis (timeout). Silakan coba lagi.');
}

export default async function(sock, message, args, query, sender, extras) {
    if (!query) {
        return sendMessage(sock, sender, `❌ Format salah. Gunakan \`${config.BOT_PREFIX}ytmp4 <link youtube>\``, { quoted: message });
    }

    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
    if (!youtubeRegex.test(query)) {
        return sendMessage(sock, sender, '❌ Link YouTube yang Anda berikan tidak valid.', { quoted: message });
    }

    if (!config.SZYRINE_API_KEY || config.SZYRINE_API_KEY === "YOUR_API_KEY_HERE") {
        console.error("SZYRINE_API_KEY belum diatur di config.js");
        return sendMessage(sock, sender, '❌ API Key belum diatur oleh pemilik bot.');
    }

    try {
        await react(sock, sender, message.key, '⏳');
        const progressMessage = await sendMessage(sock, sender, '📥 Permintaan diterima! Memulai proses download video...', { quoted: message });
        const editProgress = (text) => sock.sendMessage(sender, { text, edit: progressMessage.key });

        // --- TAHAP 1: REQUEST AWAL ---
        const initialUrl = `https://szyrineapi.biz.id/api/youtube/download/mp4?url=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
        const initialResponse = await got(initialUrl).json();

        // --- PERUBAHAN KRUSIAL: Memeriksa status di dalam object 'result' ---
        if (initialResponse.result?.status !== 202 || !initialResponse.result?.statusCheckUrl) {
            throw new Error(initialResponse.result?.message || 'Gagal memulai proses download di server.');
        }

        const { statusCheckUrl } = initialResponse.result;

        // --- TAHAP 2: POLLING STATUS ---
        await editProgress('🔄 Server sedang memproses video Anda, mohon tunggu...');
        const completedJob = await pollJobStatus(statusCheckUrl);

        const { title, link: downloadLink } = completedJob.result;

        // --- TAHAP 3: DOWNLOAD & KIRIM ---
        await editProgress(`✅ Proses selesai! Mengunduh *${title.trim()}*...`);
        
        const { buffer } = await fetchAsBufferWithMime(downloadLink);
        
        const caption = `*${title.trim()}*\n\nPowered by Synn Agent`;
        
        await sendVideo(sock, sender, buffer, caption, { quoted: message });
        await react(sock, sender, message.key, '✅');
        await editProgress(`✅ Berhasil mengirim video: *${title.trim()}*`);

    } catch (error) {
        console.error(`[Ytmp4 Error]`, error);
        await sendMessage(sock, sender, `❌ Terjadi kesalahan: ${error.message}`, { quoted: message });
        await react(sock, sender, message.key, '❌');
    }
}

export const aliases = ['ytv', 'youtubevideo'];
export const category = 'Downloaders';
export const description = 'Mengunduh video dari YouTube sebagai MP4.';
export const usage = `${config.BOT_PREFIX}ytmp4 <url>`;