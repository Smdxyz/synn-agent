// modules/downloaders/playspo.js (ENDPOINT BARU)

import { config } from '../../config.js';
import { sendMessage, sendAudio, sendImage, editMessage, react } from '../../helper.js';
import axios from 'axios';
import he from 'he';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mencari dan mengunduh lagu dari Spotify.';
export const usage = `${config.BOT_PREFIX}playspo <judul lagu>`;
export const aliases = ['spotify', 'findspo'];

async function searchSpotify(query) {
    // <-- ENDPOINT DIPERBARUI
    const { data } = await axios.get(`https://szyrineapi.biz.id/api/dl/spotify/search?q=${encodeURIComponent(query)}&limit=1&apikey=${config.SZYRINE_API_KEY}`);
    if (data?.status === 200 && Array.isArray(data.result) && data.result.length > 0) {
        const item = data.result[0];
        return {
             ...item,
             title: he.decode(item.title || 'N/A'),
             artists: he.decode(item.artists.join(', ') || 'N/A'),
             album: { ...item.album, name: he.decode(item.album?.name || 'N/A') }
        };
    }
    throw new Error(`Gagal menemukan lagu "${query}" di Spotify.`);
}

async function getSpotifyDownloadUrl(spotifyUrl) {
    try {
        // <-- ENDPOINT DIPERBARUI
        const apiUrl = `https://szyrineapi.biz.id/api/dl/spotify/download?url=${encodeURIComponent(spotifyUrl)}&apikey=${config.SZYRINE_API_KEY}`;
        const { data } = await axios.get(apiUrl, { timeout: 120000 });
        
        const downloadUrl = data.result?.link;
        
        if (downloadUrl) {
            return downloadUrl;
        } else {
            throw new Error(data.result?.message || 'API merespon tapi tidak memberikan link download.');
        }
    } catch (error) {
        console.error("Error saat mengambil link download Spotify:", error.message);
        throw new Error(`Gagal mendapatkan link download dari API. Coba lagi nanti.`);
    }
}

// --- FUNGSI UTAMA COMMAND ---
export default async function playspo(sock, message, args, query, sender) {
    if (!query) {
        return sendMessage(sock, sender, `Mau cari lagu apa dari Spotify?\nContoh: *${usage}*`, { quoted: message });
    }

    await react(sock, sender, message.key, '🎵');
    const searchMsg = await sendMessage(sock, sender, `🔎 Mencari lagu *"${query}"* di Spotify...`, { quoted: message });
    const messageKey = searchMsg.key;
    
    try {
        const song = await searchSpotify(query);

        await editMessage(sock, sender, `✅ Lagu ditemukan!\n*${song.title}* oleh *${song.artists}*.\n\nMeminta link download...`, messageKey);
        
        const downloadUrl = await getSpotifyDownloadUrl(song.url);
        
        await editMessage(sock, sender, `🔗 Link didapat! Mengunduh audio...`, messageKey);
        
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

        await sendImage(sock, sender, song.thumbnail, caption, false, { quoted: message });
        await sendAudio(sock, sender, audioBuffer, { fileName: `${song.title}.mp3`, quoted: message });
        
        await editMessage(sock, sender, '✅ Selesai!', messageKey);

    } catch (err) {
        const errorMessage = `❌ Gagal: ${err.message}`;
        console.error("[PLAY SPO] Error:", err.message);
        await editMessage(sock, sender, errorMessage, messageKey);
    }
};