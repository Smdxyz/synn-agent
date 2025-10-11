// /modules/ytshorts.js (Final & Lengkap)

import { config } from '../../config.js';
import { sendMessage, sendVideo, editMessage, deleteMessage } from '../../helper.js';
import axios from 'axios';

export default async function execute(sock, msg, args, text, sender) {
    const url = args[0];
    const usageText = `${config.BOT_PREFIX}ytshorts <url_youtube_shorts>`;

    if (!url) {
        return sendMessage(sock, sender, `Tolong berikan link YouTube Shorts-nya.\n\nContoh: \`${usageText}\``, { quoted: msg });
    }
    if (!/(?:youtube\.com\/shorts\/|youtu\.be\/)/.test(url)) {
        return sendMessage(sock, sender, `Sepertinya ini bukan link YouTube Shorts yang valid.`, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: '📥 Sedang mengambil video, sebentar ya...' }, { quoted: msg });

    try {
        const response = await axios.get('https://szyrineapi.biz.id/api/youtube/download/shorts', {
            params: { url: url },
            timeout: 30000
        });
        const result = response.data.result;
        if (response.data.status !== 200 || !result?.success || !result.download_url) {
            throw new Error(result?.message || 'Gagal mendapatkan data video dari API.');
        }

        await sendVideo(sock, sender, result.download_url, result.title || 'Ini dia videonya!', { quoted: msg });
        await deleteMessage(sock, sender, initialMsg.key);

    } catch (error) {
        let errorMessage = 'Waduh, ada kesalahan saat download videonya.';
        errorMessage += `\n\n*Detail:* ${error.message}`;
        await editMessage(sock, sender, errorMessage, initialMsg.key);
    }
}

export const category = 'Downloaders';
export const description = 'Mendownload video dari tautan YouTube Shorts.';
export const usage = `${config.BOT_PREFIX}ytshorts <url_youtube_shorts>`;
export const aliases = ['shorts', 'shortdl'];