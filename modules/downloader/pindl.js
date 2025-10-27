// /modules/downloader/pindl.js (ENDPOINT BARU & RESPON BARU)

import got from 'got';
import { config } from '../../config.js';
import { sendMessage, sendVideo, sendImage, editMessage, react } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh foto atau video dari URL Pinterest.';
export const usage = `${config.BOT_PREFIX}pindl <url>`;
export const aliases = ['pinterestdl'];

// --- FUNGSI UTAMA ---
export default async function pindl(sock, msg, args, query, sender) {
    const url = query;

    if (!url || !/pinterest\.com|pin\.it/.test(url)) {
        return sendMessage(sock, sender, `Silakan berikan URL Pinterest yang valid untuk diunduh.\n\n*Contoh:*\n\`${usage}\``, { quoted: msg });
    }

    let initialMsg;
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        await react(sock, sender, msg.key, '⏳');
        initialMsg = await sock.sendMessage(sender, { text: `⏳ Mengunduh media dari link Pinterest...` }, { quoted: msg });
        
        const apiUrl = `https://szyrineapi.biz.id/api/dl/pinterest/download?url=${encodeURIComponent(url)}&apikey=${config.SZYRINE_API_KEY}`;
        const { result } = await got(apiUrl).json();
        
        if (!result?.success || !result.media || result.media.length === 0) {
            throw new Error(result.message || 'Gagal mengunduh media dari URL tersebut.');
        }
        
        const { type, media, title, description } = result;
        const mediaUrl = media[0].url; // Ambil kualitas terbaik/pertama
        
        const caption = title || description || `Diunduh dengan ${config.botName}`;
        
        if (type === 'video') {
            await sendVideo(sock, sender, mediaUrl, caption, { quoted: msg });
        } else { // Asumsikan sisanya adalah gambar
            await sendImage(sock, sender, mediaUrl, caption, false, { quoted: msg });
        }
        
        await editProgress(`✅ Media berhasil dikirim!`);
        await react(sock, sender, msg.key, '✅');

    } catch (error) {
        console.error("[PINDL_ERROR]", error);
        const errorMessage = `❌ Terjadi kesalahan: ${error.message}`;
        if (initialMsg) {
            await editProgress(errorMessage);
        } else {
            await sendMessage(sock, sender, errorMessage, { quoted: msg });
        }
        await react(sock, sender, msg.key, '❌');
    }
}