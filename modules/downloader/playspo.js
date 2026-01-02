// modules/downloaders/playspo.js (FIXED - Get thumbnail from download API response)

import { config } from '../../config.js';
import { sendMessage, sendAudio, sendImage, editMessage, react } from '../../helper.js';
import axios from 'axios';
import he from 'he';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mencari dan mengunduh lagu dari Spotify.';
export const usage = `${config.BOT_PREFIX}playspo <judul lagu>`;
export const aliases = ['spotify', 'findspo'];

// Fungsi search tidak perlu diubah, tugasnya hanya mencari lagu dan mendapatkan URL Spotify-nya.
async function searchSpotify(query) {
    const { data } = await axios.get(`https://szyrineapi.biz.id/api/dl/spotify/search?q=${encodeURIComponent(query)}&limit=1&apikey=${config.SZYRINE_API_KEY}`);
    if (data?.status === 200 && Array.isArray(data.result) && data.result.length > 0) {
        const item = data.result[0];
        return {
             ...item,
             title: he.decode(item.title || 'N/A'),
             artists: he.decode(item.artists || 'N/A'),
             album: { ...item.album, name: he.decode(item.album?.name || 'N/A') }
        };
    }
    throw new Error(`Gagal menemukan lagu "${query}" di Spotify.`);
}

// ================== PERUBAHAN UTAMA DI SINI ==================
// Fungsi ini sekarang akan mengembalikan objek berisi URL download DAN thumbnail.
async function getSpotifyDownloadData(spotifyUrl) {
    try {
        const apiUrl = `https://szyrineapi.biz.id/api/dl/spotify/download?url=${encodeURIComponent(spotifyUrl)}&apikey=${config.SZYRINE_API_KEY}`;
        const { data } = await axios.get(apiUrl, { timeout: 120000 });
        
        const result = data.result;
        const downloadUrl = result?.downloadUrl;
        const thumbnail = result?.thumbnail; // <-- Ambil thumbnail dari sini
        
        if (result?.status === true && downloadUrl && thumbnail) {
            return { downloadUrl, thumbnail }; // <-- Kembalikan sebagai objek
        } else {
            throw new Error(result?.message || 'API merespon tapi tidak memberikan data lengkap (URL/Thumbnail).');
        }
    } catch (error) {
        console.error("Error saat mengambil data download Spotify:", error.message);
        throw new Error(`Gagal mendapatkan data download dari API. Coba lagi nanti.`);
    }
}
// ===============================================================

// --- FUNGSI UTAMA COMMAND ---
export default async function playspo(sock, message, args, query, sender) {
    if (!query) {
        return sendMessage(sock, sender, `Mau cari lagu apa dari Spotify?\nContoh: *${usage}*`, { quoted: message });
    }

    await react(sock, sender, message.key, '🎵');
    const searchMsg = await sendMessage(sock, sender, `🔎 Mencari lagu *"${query}"* di Spotify...`, { quoted: message });
    const messageKey = searchMsg.key;
    
    try {
        // 1. Cari lagu untuk mendapatkan info dasar & URL Spotify
        const song = await searchSpotify(query);

        await editMessage(sock, sender, `✅ Lagu ditemukan!\n*${song.title}* oleh *${song.artists}*.\n\nMeminta data download...`, messageKey);
        
        // 2. Dapatkan URL download DAN thumbnail dari API download
        const { downloadUrl, thumbnail } = await getSpotifyDownloadData(song.url);
        
        await editMessage(sock, sender, `🔗 Data didapat! Mengunduh audio...`, messageKey);
        
        // 3. Unduh audio buffer
        const { data: audioBuffer } = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 300000,
        });
        
        await editMessage(sock, sender, `✅ Audio berhasil diunduh. Mengirim ke kamu...`, messageKey);

        const caption = `
🎵 *Judul:* ${song.title}
🎤 *Artis:* ${song.artists}
💿 *Album:* ${song.album.name}

*${config.WATERMARK}*`.trim();

        // 4. Kirim gambar menggunakan thumbnail yang didapat dari API download
        await sendImage(sock, sender, thumbnail, caption, false, { quoted: message });
        await sendAudio(sock, sender, audioBuffer, { fileName: `${song.title}.mp3`, quoted: message });
        
        await editMessage(sock, sender, '✅ Selesai!', messageKey);

    } catch (err) {
        const errorMessage = `❌ Gagal: ${err.message}`;
        console.error("[PLAY SPO] Error:", err);
        await editMessage(sock, sender, errorMessage, messageKey);
    }
};

export const cost = 5;
