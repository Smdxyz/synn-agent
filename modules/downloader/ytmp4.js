// modules/downloader/ytmp4.js (ENDPOINT BARU)

import got from 'got';
import { config } from '../../config.js';
import { sendMessage, sendVideo, react, delay, editMessage, fetchAsBufferWithMime } from '../../helper.js';

async function pollJobStatus(statusUrl) {
    for (let i = 0; i < 30; i++) {
        await delay(4000);
        try {
            const jobStatus = await got(statusUrl).json();
            if (jobStatus.result?.status === 'completed') return jobStatus.result;
            if (jobStatus.result?.status === 'failed' || jobStatus.result?.status === 'error') {
                throw new Error(jobStatus.result.message || 'Proses di server gagal.');
            }
        } catch (e) { /* Abaikan error polling sementara, coba lagi */ }
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

    if (!config.SZYRINE_API_KEY || config.SZYRINE_API_KEY === "SANN21") {
        console.error("SZYRINE_API_KEY belum diatur di config.js");
        return sendMessage(sock, sender, '❌ API Key belum diatur oleh pemilik bot.');
    }

    let progressMessage;
    const editProgress = (text) => editMessage(sock, sender, text, progressMessage.key);
    
    try {
        await react(sock, sender, message.key, '⏳');
        progressMessage = await sendMessage(sock, sender, '📥 Permintaan diterima! Memulai proses download video...', { quoted: message });

        // ================== PERUBAHAN ENDPOINT DI SINI ==================
        const initialUrl = `https://szyrineapi.biz.id/api/dl/youtube/mp4?url=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
        // =============================================================
        const initialResponse = await got(initialUrl).json();

        if (initialResponse.result?.status === 'failed' || !initialResponse.result?.statusCheckUrl) {
            throw new Error(initialResponse.result?.message || 'Gagal memulai proses download di server.');
        }

        const { statusCheckUrl } = initialResponse.result;

        await editProgress('🔄 Server sedang memproses video Anda, mohon tunggu...');
        const completedJob = await pollJobStatus(statusCheckUrl);

        const { title, link: downloadLink } = completedJob.result;

        await editProgress(`✅ Proses selesai! Mengunduh *${title.trim()}*...`);
        
        const { buffer } = await fetchAsBufferWithMime(downloadLink);
        
        const caption = `*${title.trim()}*\n\nPowered by ${config.botName}`;
        
        await sendVideo(sock, sender, buffer, caption, { quoted: message });
        await react(sock, sender, message.key, '✅');
        await editProgress(`✅ Berhasil mengirim video: *${title.trim()}*`);

    } catch (error) {
        console.error(`[Ytmp4 Error]`, error);
        const finalErrorMessage = `❌ Terjadi kesalahan: ${error.message}`;
        if (progressMessage) {
            await editProgress(finalErrorMessage);
        } else {
            await sendMessage(sock, sender, finalErrorMessage, { quoted: message });
        }
        await react(sock, sender, message.key, '❌');
    }
}

export const aliases = ['ytv', 'youtubevideo'];
export const category = 'Downloaders';
export const description = 'Mengunduh video dari YouTube sebagai MP4.';
export const usage = `${config.BOT_PREFIX}ytmp4 <url>`;