// modules/downloader/play.js (ENDPOINT BARU)

import { config } from '../../config.js';
import { formatBytes } from '../../libs/utils.js';
import { sendMessage, sendAudio, editMessage, react } from '../../helper.js';
import { downloadYouTubeAudio } from '../../libs/youtubeDownloader.js';
import got from 'got';
import he from 'he';

/**
 * Mencari video di YouTube menggunakan endpoint baru.
 * @param {string} query Judul lagu/video yang dicari.
 * @returns {Promise<object>} Objek hasil pencarian pertama.
 */
async function searchYouTube(query) {
    const searchUrl = `https://szyrineapi.biz.id/api/dl/youtube/search?q=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
    const { result: searchResults } = await got(searchUrl).json();

    if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
        return searchResults[0]; // Ambil hasil pertama
    }
    throw new Error(`Tidak menemukan hasil untuk "${query}"`);
}

export default async (sock, msg, args, text, sender) => {
    if (!text) {
        return sendMessage(sock, sender, `Mau cari lagu apa?\nContoh: *${config.BOT_PREFIX}play Laskar Pelangi*`, { quoted: msg });
    }
    
    let progressMsg;
    const editProgress = (txt) => editMessage(sock, sender, txt, progressMsg.key);

    try {
        await react(sock, sender, msg.key, '🎵');
        progressMsg = await sock.sendMessage(sender, { text: `🕵️‍♂️ Oke, lagi nyari lagu *"${text}"*...` }, { quoted: msg });
        
        const searchResult = await searchYouTube(text);
        const videoTitle = he.decode(searchResult.title || 'N/A');
        
        await editProgress(`✅ Lagu ditemukan!\n*Judul:* ${videoTitle}\n\nMemulai proses unduh...`);

        // Panggil fungsi downloader yang sudah ada
        const { title, buffer } = await downloadYouTubeAudio(searchResult.url, editProgress);

        await editProgress('✅ Audio berhasil diunduh. Mengirim ke kamu...');
        
        const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'youtube-audio';
        await sendAudio(sock, sender, buffer, { 
            fileName: `${cleanTitle}.mp3`, 
            quoted: msg 
        });

        const fileSize = formatBytes(buffer.length);
        await editProgress(`✅ *Download Selesai!*\n\n*Judul:* ${title}\n*Ukuran:* ${fileSize}`);
        await react(sock, sender, msg.key, '✅');

    } catch (err) {
        const errorMessage = `❌ Gagal: ${err.message}`;
        if (progressMsg) {
            await editProgress(errorMessage);
        } else {
            await sendMessage(sock, sender, errorMessage, { quoted: msg });
        }
        await react(sock, sender, msg.key, '❌');
    }
};

export const category = 'Downloaders';
export const description = 'Cari dan kirim lagu dari YouTube sebagai MP3.';
export const usage = `${config.BOT_PREFIX}play <judul lagu>`;
export const aliases = ['song', 'music'];