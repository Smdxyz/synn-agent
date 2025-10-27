// /modules/info/berita.js (BARU)

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, sendCarousel, editMessage, react } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Info';
export const description = 'Menampilkan berita teratas dari Kompas.';
export const usage = `${config.BOT_PREFIX}berita`;
export const aliases = ['news', 'kompas'];

// --- Fungsi Pengambilan Data ---
async function fetchNewsDetail(url) {
    const { data } = await axios.get(`https://szyrineapi.biz.id/api/tools/news/kompas/detail?url=${encodeURIComponent(url)}&apikey=${config.SZYRINE_API_KEY}`);
    if (data?.status === 200 && data.result) {
        return data.result;
    }
    throw new Error('Gagal mengambil detail berita.');
}

// --- Handler untuk Interaksi ---
async function handleNewsSelection(sock, msg, text, context) {
    const sender = msg.key.remoteJid;
    const selection = parseInt(text.trim(), 10);
    const { newsItems } = context;

    if (isNaN(selection) || selection < 1 || selection > newsItems.length) {
        sendMessage(sock, sender, "Pilihan tidak valid.", { quoted: msg });
        return false;
    }

    const selectedNews = newsItems[selection - 1];
    const detailMsg = await sendMessage(sock, sender, `📖 Memuat berita: *"${selectedNews.title}"*...`, { quoted: msg });

    try {
        const detail = await fetchNewsDetail(selectedNews.link);
        const detailText = `*${detail.title}*\n\n*Oleh:* ${detail.author}\n*Tanggal:* ${detail.date}\n\n${detail.content}`;
        await editMessage(sock, sender, detailText, detailMsg.key);
    } catch (error) {
        await editMessage(sock, sender, `❌ Gagal memuat detail berita: ${error.message}`, detailMsg.key);
    }

    return true; // Selesai
}


// --- FUNGSI UTAMA COMMAND ---
export default async function berita(sock, msg, args, query, sender, extras) {
    const progressMsg = await sendMessage(sock, sender, '📰 Mengambil berita teratas dari Kompas...', { quoted: msg });

    try {
        const { data } = await axios.get(`https://szyrineapi.biz.id/api/tools/news/kompas?apikey=${config.SZYRINE_API_KEY}`);
        
        if (data?.status !== 200 || !data.result || data.result.length === 0) {
            throw new Error('Tidak ada berita yang bisa diambil saat ini.');
        }

        const newsItems = data.result.slice(0, 10);

        const carouselItems = newsItems.map((item, index) => ({
            url: item.image,
            title: `${index + 1}. ${item.title}`,
            body: `📅 ${item.date}`
        }));

        await sock.sendMessage(sender, { delete: progressMsg.key });
        await sendCarousel(sock, sender, carouselItems, {
            title: '🇮🇩 Berita Teratas Kompas',
            body: 'Geser untuk melihat berita lainnya.',
            footer: config.botName
        });
        
        await sendMessage(sender, `Balas dengan nomor berita (1-${carouselItems.length}) untuk membaca selengkapnya. Waktu 60 detik.`);
        extras.set(sender, 'kompas_detail', {
            timeout: 60000,
            context: { newsItems },
            handler: handleNewsSelection,
        });

    } catch (error) {
        console.error("[BERITA COMMAND ERROR]", error);
        await editMessage(sock, sender, `❌ Terjadi kesalahan: ${error.message}`, progressMsg.key);
    }
}