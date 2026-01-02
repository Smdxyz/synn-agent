// /modules/downloader/ytmp3.js

import { config } from '../../config.js';
import { sendMessage, sendAudio, editMessage, react } from '../../helper.js';
import { downloadYouTubeAudio } from '../../libs/youtubeDownloader.js';
import { formatBytes } from '../../libs/utils.js'; // <-- Gunakan formatBytes dari utils.js
export default async function(sock, message, args, query, sender, extras) {
    const userUrl = query;

    if (!userUrl || !/^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.be)\/.+$/.test(userUrl)) {
        return sendMessage(sock, sender, `Format salah.\nContoh: *${config.BOT_PREFIX}ytmp3 <url_youtube>*`, { quoted: message });
    }

    const progressMessage = await sendMessage(sock, sender, '⏳ Oke, memproses MP3...', { quoted: message });
    const editProgress = (text) => editMessage(sock, sender, text, progressMessage.key);

    try {
        await react(sock, sender, message.key, '⏳');
        
        const { title, buffer } = await downloadYouTubeAudio(userUrl, editProgress);
        
        await editProgress('✅ Audio berhasil diunduh. Mengirim ke kamu...');
        const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'youtube-audio';

        await sendAudio(sock, sender, buffer, { 
            ptt: false,
            mimetype: 'audio/mpeg',
            fileName: `${cleanTitle}.mp3`, 
            quoted: message 
        });

        const fileSize = formatBytes(buffer.length);
        const finalMessage = `✅ *Proses Selesai!*\n\n*Judul:* ${title}\n*Ukuran:* ${fileSize}`;
            
        await editProgress(finalMessage);
        await react(sock, sender, message.key, '✅');

    } catch (error) {
        console.error("Error di ytmp3:", error);
        await editProgress(`❌ Aduh, gagal:\n${error.message}`);
        await react(sock, sender, message.key, '❌');
    }
}

export const category = 'Downloaders';
export const description = 'Mengunduh audio dari YouTube sebagai MP3.';
export const usage = `${config.BOT_PREFIX}ytmp3 <url>`;
export const aliases = ['ytvn', 'yta'];

export const cost = 5;
