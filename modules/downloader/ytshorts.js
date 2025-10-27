// /modules/downloader/ytshorts.js (ENDPOINT BARU)

import { config } from '../../config.js';
import { sendMessage, sendVideo, editMessage, react } from '../../helper.js';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mendownload video dari tautan YouTube Shorts.';
export const usage = `${config.BOT_PREFIX}ytshorts <url_youtube_shorts>`;
export const aliases = ['shorts', 'shortdl'];

// --- FUNGSI UTAMA ---
export default async function ytshorts(sock, msg, args, query, sender) {
    const url = query;

    if (!url) {
        return sendMessage(sock, sender, `Tolong berikan link YouTube Shorts.\n\n*Contoh:*\n\`${usage}\``, { quoted: msg });
    }
    // Regex diperbarui untuk mencakup format youtu.be/xxxx dan youtube.com/shorts/xxxx
    if (!/(?:youtube\.com\/shorts\/|youtu\.be\/)/.test(url)) {
        return sendMessage(sock, sender, `Sepertinya ini bukan link YouTube Shorts yang valid.`, { quoted: msg });
    }

    let initialMsg;
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);
    
    try {
        await react(sock, sender, msg.key, '⏳');
        initialMsg = await sock.sendMessage(sender, { text: '📥 Sedang mengambil video, sebentar ya...' }, { quoted: msg });

        // ================== PERUBAHAN ENDPOINT DI SINI ==================
        const apiUrl = `https://szyrineapi.biz.id/api/dl/youtube/shorts?url=${encodeURIComponent(url)}&apikey=${config.SZYRINE_API_KEY}`;
        // ==============================================================
        
        const { data: response } = await axios.get(apiUrl, { timeout: 60000 });
        
        const result = response.result;
        if (response.status !== 200 || !result?.success || !result.download_url) {
            throw new Error(result?.message || 'Gagal mendapatkan data video dari API.');
        }

        const caption = result.title || `Video Shorts`;
        await sendVideo(sock, sender, result.download_url, caption, { quoted: msg });
        
        await editProgress(`✅ Video *"${caption}"* berhasil dikirim!`);
        await react(sock, sender, msg.key, '✅');

    } catch (error) {
        console.error("[YTSHORTS ERROR]", error);
        const errorMessage = `❌ Gagal mengunduh video: ${error.message}`;
        if (initialMsg) {
            await editProgress(errorMessage);
        } else {
            await sendMessage(sock, sender, errorMessage, { quoted: msg });
        }
        await react(sock, sender, msg.key, '❌');
    }
}