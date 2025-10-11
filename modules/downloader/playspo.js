// modules/downloaders/playspo.js (REVISED FOR NEW API RESPONSE)

import { config } from '../../config.js';
import { sendMessage, sendAudio, sendImage, editMessage, react } from '../../helper.js';
import axios from 'axios';
import he from 'he'; // Untuk membersihkan karakter HTML aneh di judul/artis

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mencari dan mengunduh lagu dari Spotify.';
export const usage = `${config.BOT_PREFIX}playspo <judul lagu>`;
export const aliases = ['spotify', 'findspo'];

/**
 * Langkah 1: Mencari lagu di Spotify untuk mendapatkan metadata dan URL.
 * Fungsi ini masih relevan dan tidak perlu diubah.
 * @param {string} query Judul lagu yang dicari.
 * @returns {Promise<object>} Metadata lagu.
 */
async function searchSpotify(query) {
    const { data } = await axios.get(`https://szyrineapi.biz.id/api/downloaders/spotify/search?q=${encodeURIComponent(query)}&limit=1`);
    if (data?.status === 200 && Array.isArray(data.result) && data.result.length > 0) {
        const item = data.result[0];
        // Membersihkan teks dari HTML entities (e.g., &amp; -> &)
        return {
             ...item,
             title: he.decode(item.title || 'N/A'),
             artists: he.decode(item.artists || 'N/A'),
             album: { ...item.album, name: he.decode(item.album?.name || 'N/A') }
        };
    }
    throw new Error(`Gagal menemukan lagu "${query}" di Spotify.`);
}

/**
 * Langkah 2: Mendapatkan link download dari URL Spotify.
 * [PERBAIKAN UTAMA] Fungsi ini diubah total sesuai respons API baru.
 * @param {string} spotifyUrl URL lagu dari hasil pencarian.
 * @returns {Promise<string>} URL download MP3.
 */
async function getSpotifyDownloadUrl(spotifyUrl) {
    try {
        const apiUrl = `https://szyrineapi.biz.id/api/downloaders/spotify?url=${encodeURIComponent(spotifyUrl)}&apikey=${config.SZYRINE_API_KEY}`;
        
        const { data } = await axios.get(apiUrl, { 
            timeout: 120000 // Timeout 2 menit untuk jaga-jaga
        });
        
        // Mengambil link download dari struktur respons yang baru
        const downloadUrl = data.result?.downloadUrl;
        
        if (downloadUrl) {
            return downloadUrl;
        } else {
            throw new Error(data.message || 'API merespon tapi tidak memberikan link download.');
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
        // Step 1: Cari metadata lagu
        const song = await searchSpotify(query);

        await editMessage(sock, sender, `✅ Lagu ditemukan!\n*${song.title}* oleh *${song.artists}*.\n\nMeminta link download...`, messageKey);
        
        // Step 2: Dapatkan link download dari URL Spotify
        const downloadUrl = await getSpotifyDownloadUrl(song.url);
        
        await editMessage(sock, sender, `🔗 Link didapat! Mengunduh audio...`, messageKey);
        
        // Step 3: Unduh audio ke buffer
        const { data: audioBuffer } = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 300000, // Timeout 5 menit untuk download
        });
        
        await editMessage(sock, sender, `✅ Audio berhasil diunduh. Mengirim ke kamu...`, messageKey);

        const caption = `
🎵 *Judul:* ${song.title}
🎤 *Artis:* ${song.artists}
💿 *Album:* ${song.album.name}

*${config.WATERMARK}*`.trim();

        // Step 4: Kirim gambar album dan file audio
        await sendImage(sock, sender, song.album.image_url, caption, false, { quoted: message });
        await sendAudio(sock, sender, audioBuffer, { fileName: `${song.title}.mp3`, quoted: message });
        
        await editMessage(sock, sender, '✅ Selesai!', messageKey);

    } catch (err) {
        const errorMessage = `❌ Gagal: ${err.message}`;
        console.error("[PLAY SPO] Error:", err.message);
        await editMessage(sock, sender, errorMessage, messageKey);
    }
};