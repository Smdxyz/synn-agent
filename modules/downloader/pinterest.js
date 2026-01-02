// /modules/downloader/pinterest.js (MODIFIED WITH UPSCALE INTERACTION)

import got from 'got';
import FormData from 'form-data';
import axios from 'axios';
import { config } from '../../config.js';
import H from '../../helper.js'; // Import H untuk akses semua helper

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mencari gambar dari Pinterest dan menyediakan opsi untuk upscale ke resolusi tinggi (4x).';
export const usage = `${config.BOT_PREFIX}pinterest <query>`;
export const aliases = [
  'pin', 'pinterestsearch', 'pinimg', 'pinterestimg',
  // Alias video sengaja dipisahkan logikanya
  'pinvid', 'pinterestvid', 'pinterestvideo'
];

// --- HANDLER UNTUK SELEKSI UPSCALE ---
async function handleUpscaleSelection(sock, message, text, context) {
    const jid = message.key.remoteJid;

    // Validasi apakah ini balasan yang kita tunggu
    if (!text.startsWith('pin_upscale_')) {
        H.sendMessage(sock, jid, 'Pilihan tidak valid. Silakan tekan tombol "UHD Upscale 4x" di bawah gambar.', { quoted: message });
        return false; // Jangan hapus state, tunggu balasan yang benar
    }

    const index = parseInt(text.split('_')[2], 10);
    const selectedUrl = context.imageUrls[index];

    if (!selectedUrl) {
        H.sendMessage(sock, jid, 'Gagal menemukan gambar yang dipilih. Silakan coba lagi.', { quoted: message });
        return true; // Hapus state karena terjadi error
    }
    
    let progressMsg;
    try {
        progressMsg = await H.sendMessage(sock, jid, `✅ Pilihan diterima! Mengunduh gambar untuk persiapan upscale...`, { quoted: message });
        const messageKey = progressMsg.key;
        
        // 1. Download gambar dari URL pinterest
        const { buffer, mimetype } = await H.fetchAsBufferWithMime(selectedUrl);
        await H.editMessage(sock, jid, '⏳ Menyiapkan mesin Pixnova... Proses upscale *4x* dimulai.', messageKey);

        // 2. Siapkan dan kirim ke API Upscale
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('scale', '4');

        const { data: jobData } = await axios.post('https://szyrineapi.biz.id/api/img/pixnova/image-upscale', form, { 
          headers: form.getHeaders() 
        });

        if (!jobData.result?.statusUrl) {
          throw new Error(jobData.message || 'Gagal membuat job upscale.');
        }

        await H.editMessage(sock, jid, `🚀 Upscaling sedang berjalan... Ini mungkin butuh waktu beberapa saat.`, messageKey);

        // 3. Tunggu hasilnya
        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);
        
        // 4. Kirim hasil
        await H.sendImage(sock, jid, finalUrl, `*🚀 Gambar berhasil di-upscale 4x!*`, false, { quoted: message });
        await sock.sendMessage(jid, { delete: messageKey });

    } catch (error) {
        console.error("[PINTEREST_UPSCALE_HANDLER] Error:", error.response ? error.response.data : error.message);
        const errorMessage = error.message || 'Gagal memproses gambar.';
        if (progressMsg) {
            await H.editMessage(sock, jid, `❌ Gagal: ${errorMessage}`, progressMsg.key);
        } else {
            await H.sendMessage(sock, jid, `❌ Gagal: ${errorMessage}`, { quoted: message });
        }
    } finally {
        return true; // Hapus state setelah selesai (baik sukses maupun gagal)
    }
}


// --- FUNGSI UTAMA ---
export default async function pinterest(sock, message, args, query, sender, extras) {
    const jid = message.key.remoteJid;

    const fullText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const usedAlias = fullText.startsWith(config.BOT_PREFIX)
        ? fullText.slice(config.BOT_PREFIX.length).trim().split(/ +/)[0].toLowerCase()
        : '';
    const isVideoSearch = /vid/.test(usedAlias);

    if (!query) {
        return H.sendMessage(sock, jid, `Contoh:\n\`${config.BOT_PREFIX}pinterest jkt48\`\n\`${config.BOT_PREFIX}pinvid cat cinematic\``, { quoted: message });
    }
    
    let progressMsg;
    const editProgress = (txt) => H.editMessage(sock, jid, txt, progressMsg.key);

    try {
        await H.react(sock, jid, message.key, '🔍');
        
        // --- LOGIKA VIDEO (TIDAK BERUBAH) ---
        if (isVideoSearch) {
            progressMsg = await H.sendMessage(sock, jid, `🎬 Mencari video Pinterest untuk *"${query}"*...`, { quoted: message });
            const apiUrl = `https://szyrineapi.biz.id/api/dl/pinterest/search-video?q=${encodeURIComponent(query)}`;
            const { result: videos } = await got(apiUrl).json();
            if (!videos || videos.length === 0) throw new Error(`Tidak ditemukan hasil video untuk "${query}".`);
            const firstVideo = videos.find(v => v.videoUrl);
            if (!firstVideo) throw new Error(`Tidak ada link video yang valid.`);
            const caption = `*🎬 Video dari Pinterest*\n\n*Judul:* ${firstVideo.title || query}`;
            await H.sendVideo(sock, jid, firstVideo.videoUrl, caption, { quoted: message });
            await editProgress(`✅ Video berhasil dikirim!`);
            await H.react(sock, jid, message.key, '✅');
            return;
        }

        // --- LOGIKA GAMBAR BARU DENGAN INTERAKSI ---
        progressMsg = await H.sendMessage(sock, jid, `🖼️ Mencari gambar Pinterest untuk *"${query}"*...`, { quoted: message });
        
        const apiUrl = `https://szyrineapi.biz.id/api/dl/pinterest/search?q=${encodeURIComponent(query)}`;
        const { result: images } = await got(apiUrl).json();

        if (!images || images.length === 0) {
            throw new Error(`Tidak ditemukan hasil gambar untuk "${query}".`);
        }
        
        const imageCount = Math.min(images.length, 5); // Ambil maksimal 5 gambar
        await editProgress(`✨ Mempersiapkan ${imageCount} gambar untuk dipilih...`);

        const carouselItems = images.slice(0, imageCount).map((img, index) => ({
            image: { url: img.imageLink },
            body: img.title || `Hasil ke-${index + 1}`,
            footer: `Oleh: ${img.author || 'Tidak diketahui'}`,
            buttons: [{ buttonId: `pin_upscale_${index}`, displayText: '✨ UHD Upscale 4x ✨' }]
        }));
        
        // Simpan URL untuk digunakan di handler nanti
        const imageUrls = images.slice(0, imageCount).map(img => img.imageLink);

        await H.sendCarousel(sock, jid, carouselItems, {
            title: `🖼️ Hasil Pencarian Pinterest`,
            text: `Menampilkan ${carouselItems.length} gambar untuk "${query}".\n\nTekan tombol di bawah gambar untuk meningkatkan resolusinya.`,
            footer: config.WATERMARK || config.botName
        });
        
        // Atur state untuk menunggu pilihan pengguna
        extras.set(sender, 'pinterest_upscale', {
            handler: handleUpscaleSelection,
            context: { imageUrls: imageUrls }, // Kirim daftar URL ke handler
            timeout: 120000 // Beri waktu 2 menit untuk memilih
        });
        
        await sock.sendMessage(jid, { delete: progressMsg.key });
        await H.react(sock, jid, message.key, '✅');

    } catch (err) {
        console.error('[PINTEREST_SEARCH_ERROR]', err);
        const errorMessage = `❌ Terjadi kesalahan: ${err?.message || 'Error tidak diketahui'}`;
        if (progressMsg) { await editProgress(errorMessage); }
        else { await H.sendMessage(sock, jid, errorMessage, { quoted: message }); }
        await H.react(sock, jid, message.key, '❌');
    }
}

export const cost = 5;
