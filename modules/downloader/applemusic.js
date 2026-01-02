// /modules/downloaders/applemusic.js

import axios from 'axios';
import { config } from '../../config.js';
import { 
    sendMessage, 
    sendImage, 
    sendAudio, 
    editMessage, 
    fetchAsBufferWithMime 
} from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh lagu dari Apple Music.';
export const usage = `${config.BOT_PREFIX}applemusic <url>`;
export const aliases = ['amdl', 'appledl'];

// --- FUNGSI UTAMA ---
export default async function applemusic(sock, msg, args, query) {
    const url = query;
    const sender = msg.key.remoteJid;

    if (!url || !/(?:https?:\/\/)?music\.apple\.com\//.test(url)) {
        return sendMessage(sock, sender, `Silakan berikan link Apple Music yang valid.\n\n*Contoh:*\n\`${usage}\``, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Memproses link dari Apple Music...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        await editProgress('🔍 Meminta data dari API...');
        
        const apiUrl = 'https://szyrineapi.biz.id/api/dl/apple-music';
        const { data: apiResponse } = await axios.get(apiUrl, {
            params: { url },
            timeout: 60000 // 1 menit timeout
        });

        if (apiResponse.status !== 200 || !apiResponse.result?.downloadUrl) {
            throw new Error(apiResponse.result?.message || 'Gagal mendapatkan link unduhan dari API.');
        }

        const result = apiResponse.result;

        await editProgress(`✅ Data diterima! Mengunduh *${result.title}*...`);

        // Unduh thumbnail dan audio secara bersamaan
        const [thumbData, audioData] = await Promise.all([
            fetchAsBufferWithMime(result.thumbnail),
            fetchAsBufferWithMime(result.downloadUrl)
        ]);

        const caption = `*${result.title}*\nArtis: ${result.artist}\nAlbum: ${result.album}\n\nDiunduh oleh ${config.botName}`;

        await editProgress('📤 Mengirim media...');

        // Kirim thumbnail dengan caption
        await sendImage(sock, sender, thumbData.buffer, caption, false, { quoted: msg });
        
        // Kirim file audio
        await sendAudio(sock, sender, audioData.buffer, { mimetype: audioData.mimetype || 'audio/mp4' });

        // Hapus pesan "processing..." setelah selesai
        await editMessage(sock, sender, `✅ Berhasil mengunduh dan mengirim lagu.`, initialMsg.key);

    } catch (error) {
        console.error(`[APPLE_MUSIC_ERROR]`, error);
        const errorMessage = error.response ? (error.response.data?.message || JSON.stringify(error.response.data)) : error.message;
        await editProgress(`❌ Terjadi kesalahan: ${errorMessage}`);
    }
}

export const cost = 5;
