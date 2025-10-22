// /modules/downloaders/pindl.js (KHUSUS UNTUK DOWNLOAD DARI URL)

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, sendVideo, sendImage, editMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh foto atau video dari URL Pinterest.';
export const usage = `${config.BOT_PREFIX}pindl <url>`;
export const aliases = ['pinterestdl'];

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args) {
    const sender = msg.key.remoteJid;
    const url = args[0];

    if (!url || !/pinterest\.com|pin\.it/.test(url)) {
        return sendMessage(sock, sender, `Silakan berikan URL Pinterest yang valid untuk diunduh.\n\n*Contoh:*\n\`${config.BOT_PREFIX}pindl https://pin.it/1R9f6ZMAt\``, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Mengunduh media dari link Pinterest...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        const apiParams = { 
            url,
            ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
        };
        
        const { data } = await axios.get('https://szyrineapi.biz.id/api/downloaders/pinterest/dl-v2', { params: apiParams });
        
        if (data.status !== 200 || !data.result.mediaUrl) {
            throw new Error(data.message || 'Gagal mengunduh media dari URL tersebut.');
        }
        
        const { isVideo, mediaUrl, description, title } = data.result;
        const caption = title || description || `Diunduh dengan ${config.BOT_NAME}`;
        
        if (isVideo) {
            await sendVideo(sock, sender, mediaUrl, caption, { quoted: msg });
        } else {
            await sendImage(sock, sender, mediaUrl, caption, false, { quoted: msg });
        }
        await editMessage(sock, sender, `✅ Media berhasil dikirim!`, initialMsg.key);

    } catch (error) {
        console.error("[PINDL_ERROR]", error);
        await editProgress(`❌ Terjadi kesalahan: ${error.message}`);
    }
}