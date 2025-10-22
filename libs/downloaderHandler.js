// /libs/downloaderHandler.js

import axios from 'axios';
import { config } from '../config.js';
import {
    sendMessage,
    sendVideo,
    sendAlbum,
    editMessage,
    fetchAsBufferWithMime,
    delay
} from '../helper.js';

/**
 * Handler generik untuk downloader yang menggunakan Szyrine API.
 * @param {object} sock - Socket Baileys
 * @param {object} msg - Objek pesan
 * @param {string} url - URL yang diberikan pengguna
 * @param {object} options - Opsi spesifik untuk platform
 * @param {string} options.platformName - Nama platform (e.g., 'X/Twitter', 'Threads')
 * @param {string} options.apiUrl - Endpoint API
 * @param {function} options.captionFormatter - Fungsi untuk memformat caption dari hasil API
 */
export async function handleApiDownloader(sock, msg, url, options) {
    const { platformName, apiUrl, captionFormatter } = options;
    const sender = msg.key.remoteJid;

    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Memproses link dari ${platformName}...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        await editProgress(`🔍 Meminta data dari API untuk ${platformName}...`);
        
        // Tambahkan SZYRINE_API_KEY jika ada di config
        const apiParams = {
            url,
            ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
        };

        const { data: apiResponse } = await axios.get(apiUrl, {
            params: apiParams,
            timeout: 60000 // 1 menit timeout
        });

        if (apiResponse.status !== 200 || !apiResponse.result) {
            throw new Error(apiResponse.message || 'Gagal mendapatkan data dari API.');
        }

        const result = apiResponse.result;
        const caption = captionFormatter(result);
        const mediaItems = result.media || [];

        if (mediaItems.length === 0) {
            // Jika tidak ada media, kirim teksnya saja
            return editProgress(caption);
        }

        await editProgress(`✅ Data diterima! Total media: ${mediaItems.length}. Mengunduh...`);

        const photos = mediaItems.filter(m => m.type === 'photo');
        const videos = mediaItems.filter(m => m.type === 'video');
        let mediaSent = false;

        // --- Kirim Foto (sebagai album jika lebih dari satu) ---
        if (photos.length > 0) {
            await editProgress(`🖼️ Mengunduh ${photos.length} foto...`);
            const albumPayload = [];
            for (const [index, photo] of photos.entries()) {
                try {
                    const { buffer } = await fetchAsBufferWithMime(photo.url);
                    albumPayload.push({
                        image: buffer,
                        caption: (index === 0) ? caption : '' // Caption hanya di gambar pertama
                    });
                } catch (e) {
                     console.error(`[DOWNLOADER_HANDLER] Gagal unduh foto: ${photo.url}`, e);
                }
            }
             if (albumPayload.length > 0) {
                await sendAlbum(sock, sender, albumPayload, { quoted: msg });
                mediaSent = true;
             }
        }

        // --- Kirim Video (satu per satu) ---
        if (videos.length > 0) {
            for (const [index, video] of videos.entries()) {
                await editProgress(`🎬 Mengunduh video ${index + 1}/${videos.length}...`);
                 try {
                    const { buffer } = await fetchAsBufferWithMime(video.url);
                    // Beri caption hanya di video pertama, DAN jika belum ada foto yang dikirim
                    const videoCaption = !mediaSent && index === 0 ? caption : '';
                    await sendVideo(sock, sender, buffer, videoCaption, { quoted: msg });
                    await delay(1000); // Jeda antar video
                } catch (e) {
                     console.error(`[DOWNLOADER_HANDLER] Gagal unduh video: ${video.url}`, e);
                     await sendMessage(sock, sender, `❌ Gagal mengunduh video ${index + 1}.`, { quoted: msg });
                }
            }
        }

        await editProgress('✅ Semua media berhasil diproses dan dikirim!');

    } catch (error) {
        console.error(`[${platformName.toUpperCase()}_ERROR]`, error);
        const errorMessage = error.response ? (error.response.data?.message || JSON.stringify(error.response.data)) : error.message;
        await editProgress(`❌ Terjadi kesalahan: ${errorMessage}`);
    }
}