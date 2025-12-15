// /libs/downloaderHandler.js (FIXED FOR NEW API STRUCTURE)

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
 * @param {string} options.platformName - Nama platform (e.g., 'Instagram', 'Facebook')
 * @param {string} options.apiUrl - Endpoint API
 * @param {function} options.captionFormatter - Fungsi untuk memformat caption dari hasil API
 * @param {function} [options.urlPreProcessor] - (Opsional) Fungsi untuk memproses URL sebelum request API
 */
export async function handleApiDownloader(sock, msg, url, options) {
    const { platformName, apiUrl, captionFormatter, urlPreProcessor } = options;
    const sender = msg.key.remoteJid;

    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Memproses link dari ${platformName}...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        let processedUrl = url;
        if (typeof urlPreProcessor === 'function') {
            await editProgress(`🔄 Mengonversi link ${platformName}...`);
            processedUrl = await urlPreProcessor(url);
        }
        
        await editProgress(`🔍 Meminta data dari API untuk ${platformName}...`);
        
        const apiParams = {
            url: processedUrl,
            ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
        };

        const { data: apiResponse } = await axios.get(apiUrl, {
            params: apiParams,
            timeout: 60000
        });

        // --- PERBAIKAN 1: Cek keberadaan `result` saja, bukan `result.success` ---
        if (apiResponse.status !== 200 || !apiResponse.result) {
            throw new Error(apiResponse.result?.message || 'Gagal mendapatkan data dari API atau format tidak dikenali.');
        }

        const result = apiResponse.result;
        const caption = captionFormatter(result);
        const mediaItems = result.media || [];

        if (mediaItems.length === 0) {
            return editProgress(`⚠️ Tidak ada media yang bisa diunduh dari link ini.`);
        }

        await editProgress(`✅ Data diterima! Total media: ${mediaItems.length}. Mengunduh...`);

        // --- PERBAIKAN 2: Tambahkan 'photo' sebagai tipe gambar yang valid ---
        const photos = mediaItems.filter(m => m.type === 'image' || m.type === 'photo');
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
                        caption: (index === 0) ? caption : ''
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
                    const videoCaption = !mediaSent && index === 0 ? caption : '';
                    await sendVideo(sock, sender, buffer, videoCaption, { quoted: msg });
                    await delay(1000);
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