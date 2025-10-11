import { config } from '../../config.js';
import { formatBytes } from '../../libs/utils.js';
import { sendMessage, sendAudio, editMessage } from '../../helper.js';
import { downloadYouTubeAudio } from '../../libs/youtubeDownloader.js'; // <-- IMPORT FUNGSI BARU
import axios from 'axios';
import he from 'he';

async function searchYouTube(query) {
    const { data } = await axios.get(`https://szyrineapi.biz.id/api/youtube/search?q=${encodeURIComponent(query)}`);
    if (data?.status === 200 && Array.isArray(data.result) && data.result.length > 0) {
        return data.result[0]; // Hanya butuh URL dan judul untuk konfirmasi
    }
    throw new Error(`Tidak menemukan hasil untuk "${query}"`);
}

export default async (sock, msg, args, text, sender) => {
    if (!text) {
        return sendMessage(sock, sender, `Mau cari lagu apa?\nContoh: *${config.BOT_PREFIX}play Laskar Pelangi*`, { quoted: msg });
    }
    
    const progressMsg = await sock.sendMessage(sender, { text: `🕵️‍♂️ Oke, lagi nyari lagu *"${text}"*...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, progressMsg.key);

    try {
        const searchResult = await searchYouTube(text);
        const videoTitle = he.decode(searchResult.title || 'N/A');
        
        await editProgress(`✅ Lagu ditemukan!\n*Judul:* ${videoTitle}\n\nMemulai proses unduh...`);

        // Panggil fungsi yang sama
        const { title, buffer } = await downloadYouTubeAudio(searchResult.url, editProgress);

        await editProgress('✅ Audio berhasil diunduh. Mengirim ke kamu...');
        const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'youtube-audio';
        await sendAudio(sock, sender, buffer, { fileName: `${cleanTitle}.mp3`, quoted: msg });

        const fileSize = formatBytes(buffer.length);
        await editProgress(`✅ *Download Selesai!*\n\n*Judul:* ${title}\n*Ukuran:* ${fileSize}`);

    } catch (err) {
        await editProgress(`❌ Gagal: ${err.message}`);
    }
};

export const category = 'Downloaders';
export const description = 'Cari dan kirim lagu dari YouTube sebagai MP3.';
export const usage = `${config.BOT_PREFIX}play <judul lagu>`;
export const aliases = ['song', 'music'];