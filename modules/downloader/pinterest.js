// /modules/downloader/pinterest.js (FINAL VERSION)

import got from 'got';
import { config } from '../../config.js';
import { sendMessage, sendVideo, sendCarousel, react, editMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mencari gambar atau video dari Pinterest.';
export const usage = `${config.BOT_PREFIX}pinterest <query>`;
export const aliases = [
  'pin', 'pinterestsearch', 'pinimg', 'pinterestimg',
  'pinvid', 'pinterestvid', 'pinterestvideo'
];

// --- FUNGSI UTAMA ---
export default async function pinterest(sock, message, args, query, sender, extras) {
    const jid = message.key.remoteJid;

    const fullText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const usedAlias = fullText.startsWith(config.BOT_PREFIX)
        ? fullText.slice(config.BOT_PREFIX.length).trim().split(/ +/)[0].toLowerCase()
        : '';
    const isVideoSearch = /vid/.test(usedAlias);

    if (!query) {
        return sendMessage(sock, jid, `Contoh:\n\`${config.BOT_PREFIX}pinterest jkt48\`\n\`${config.BOT_PREFIX}pinvid cat cinematic\``, { quoted: message });
    }
    
    let progressMsg;
    const editProgress = (txt) => editMessage(sock, jid, txt, progressMsg.key);

    try {
        await react(sock, jid, message.key, '🔍');
        
        if (isVideoSearch) {
            // ... (logika video tidak berubah)
            progressMsg = await sendMessage(sock, jid, `🎬 Mencari video Pinterest untuk *"${query}"*...`, { quoted: message });
            const apiUrl = `https://szyrineapi.biz.id/api/dl/pinterest/search-video?q=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
            const { result: videos } = await got(apiUrl).json();
            if (!videos || videos.length === 0) throw new Error(`Tidak ditemukan hasil video untuk "${query}".`);
            const firstVideo = videos.find(v => v.videoUrl);
            if (!firstVideo) throw new Error(`Tidak ada link video yang valid.`);
            const caption = `*🎬 Video dari Pinterest*\n\n*Judul:* ${firstVideo.title || query}`;
            await sendVideo(sock, jid, firstVideo.videoUrl, caption, { quoted: message });
            await editProgress(`✅ Video berhasil dikirim!`);
            await react(sock, jid, message.key, '✅');
            return;
        }

        progressMsg = await sendMessage(sock, jid, `🖼️ Mencari gambar Pinterest untuk *"${query}"*...`, { quoted: message });
        
        const apiUrl = `https://szyrineapi.biz.id/api/dl/pinterest/search?q=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
        const { result: images } = await got(apiUrl).json();

        if (!images || images.length === 0) {
            throw new Error(`Tidak ditemukan hasil gambar untuk "${query}".`);
        }
        
        await editProgress(`✨ Mempersiapkan ${images.slice(0, 5).length} gambar untuk carousel...`);

        // Cukup siapkan payload sederhana. helper.js akan menangani sisanya.
        const carouselItems = images.slice(0, 5).map((img, index) => ({
            image: { url: img.imageLink }, // Kirim URL, helper akan memprosesnya
            body: img.title || `Hasil ke-${index + 1}`,
            footer: `Oleh: ${img.author || 'Tidak diketahui'}`,
            buttons: [{ buttonId: `pinterest_img_${index}`, displayText: 'Pilih' }]
        }));

        await sendCarousel(sock, jid, carouselItems, {
            title: `🖼️ Hasil Pencarian Pinterest`,
            text: `Menampilkan ${carouselItems.length} gambar untuk "${query}"`,
            footer: config.WATERMARK || config.botName
        });
        
        await sock.sendMessage(jid, { delete: progressMsg.key });
        await react(sock, jid, message.key, '✅');

    } catch (err) {
        console.error('[PINTEREST_SEARCH_ERROR]', err);
        const errorMessage = `❌ Terjadi kesalahan: ${err?.message || 'Error tidak diketahui'}`;
        if (progressMsg) { await editProgress(errorMessage); }
        else { await sendMessage(sock, jid, errorMessage, { quoted: message }); }
        await react(sock, jid, message.key, '❌');
    }
}