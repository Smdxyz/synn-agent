// /modules/downloader/pinterest.js (REMASTERED - SEARCH IMG & VID)

import got from 'got';
import { config } from '../../config.js';
import { sendMessage, sendVideo, sendCarousel, react, editMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mencari gambar atau video dari Pinterest.';
export const usage = `${config.BOT_PREFIX}pinterest <query>`;
export const aliases = [
  'pin', 'pinterestsearch', 'pinimg', 'pinterestimg', // Alias untuk gambar
  'pinvid', 'pinterestvid', 'pinterestvideo' // Alias untuk video
];

// --- FUNGSI UTAMA ---
export default async function pinterest(sock, message, args, query, sender, extras) {
    const jid = message.key.remoteJid;

    // Mendeteksi command yang digunakan untuk membedakan pencarian gambar/video
    const fullText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const usedAlias = fullText.startsWith(config.BOT_PREFIX)
        ? fullText.slice(config.BOT_PREFIX.length).trim().split(/ +/)[0].toLowerCase()
        : '';
    const isVideoSearch = /vid/.test(usedAlias);

    if (!query) {
        return sendMessage(sock, jid,
            `Silakan masukkan kata kunci pencarian.\n\n*Contoh Gambar:*\n\`${config.BOT_PREFIX}pinterest jkt48 christy\`\n\n*Contoh Video:*\n\`${config.BOT_PREFIX}pinvid cat cinematic\``,
            { quoted: message }
        );
    }
    
    let progressMsg;
    const editProgress = (txt) => editMessage(sock, jid, txt, progressMsg.key);

    try {
        await react(sock, jid, message.key, '🔍');
        
        // ================== LOGIKA PENCARIAN VIDEO ==================
        if (isVideoSearch) {
            progressMsg = await sendMessage(sock, jid, `🎬 Mencari video Pinterest untuk *"${query}"*...`, { quoted: message });
            
            const apiUrl = `https://szyrineapi.biz.id/api/dl/pinterest/search-video?q=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
            const { result: videos } = await got(apiUrl).json();

            if (!videos || videos.length === 0) {
                throw new Error(`Tidak ditemukan hasil video untuk "${query}".`);
            }
            
            // Ambil video pertama yang valid
            const firstVideo = videos.find(v => v.videoUrl);
            if (!firstVideo) {
                 throw new Error(`Hasil ditemukan, tapi tidak ada link video yang valid.`);
            }

            const caption = `*🎬 Video dari Pinterest*\n\n*Judul:* ${firstVideo.title || query}`;
            await sendVideo(sock, jid, firstVideo.videoUrl, caption, { quoted: message });
            await editProgress(`✅ Video berhasil dikirim!`);
            await react(sock, jid, message.key, '✅');
            return;
        }

        // ================== LOGIKA PENCARIAN GAMBAR (DEFAULT) ==================
        progressMsg = await sendMessage(sock, jid, `🖼️ Mencari gambar Pinterest untuk *"${query}"*...`, { quoted: message });
        
        const apiUrl = `https://szyrineapi.biz.id/api/dl/pinterest/search?q=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
        const { result: images } = await got(apiUrl).json();

        if (!images || images.length === 0) {
            throw new Error(`Tidak ditemukan hasil gambar untuk "${query}".`);
        }

        // Siapkan item untuk Carousel
        const carouselItems = images.slice(0, 10).map(img => ({
            url: img.imageLink,
            title: img.title || query,
            body: `Oleh: ${img.author || 'Tidak diketahui'}`
        }));

        await sendCarousel(sock, jid, carouselItems, {
            title: `🖼️ Hasil Pencarian Pinterest`,
            body: `Menampilkan ${carouselItems.length} gambar untuk "${query}"`,
            footer: config.WATERMARK || config.botName
        });
        
        // Hapus pesan "mencari..." karena carousel tidak bisa di-edit
        await sock.sendMessage(jid, { delete: progressMsg.key });
        await react(sock, jid, message.key, '✅');

    } catch (err) {
        console.error('[PINTEREST_SEARCH_ERROR]', err);
        const errorMessage = `❌ Terjadi kesalahan: ${err?.message || 'Error tidak diketahui'}`;
        if (progressMsg) {
            await editProgress(errorMessage);
        } else {
             await sendMessage(sock, jid, errorMessage, { quoted: message });
        }
        await react(sock, jid, message.key, '❌');
    }
}