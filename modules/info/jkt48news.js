// /modules/info/jktnews.js

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, editMessage, delay } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Info';
export const description = 'Menampilkan berita terbaru dari website resmi JKT48.';
export const usage = `${config.BOT_PREFIX}jktnews`;
export const aliases = ['jkt48news'];

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args, query, sender, extras) {
    const initialMsg = await sock.sendMessage(sender, { text: `📰 Mengambil berita terbaru dari JKT48...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        const apiParams = {
            ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
        };

        const { data: newsList } = await axios.get('https://szyrineapi.biz.id/api/scraper/jkt48/news', { params: apiParams });

        if (newsList.status !== 200 || newsList.result.length === 0) {
            throw new Error('Tidak dapat mengambil daftar berita saat ini.');
        }

        const newsItems = newsList.result;
        let responseText = `*Berita Terbaru JKT48*\n\n`;
        newsItems.slice(0, 10).forEach((item, index) => {
            responseText += `*${index + 1}.* ${item.title}\n  📅 ${item.date}\n\n`;
        });
        responseText += `Balas dengan nomor berita (1-10) untuk membaca detailnya. Waktu 60 detik.`;

        await editProgress(responseText);

        // --- Set waitState untuk menunggu balasan nomor dari user ---
        extras.set(sender, 'jktnews_detail', {
            timeout: 60000, // 60 detik
            context: { newsItems }, // Simpan daftar berita di context
            handler: handleNewsDetailSelection,
        });

    } catch (error) {
        console.error("[JKTNEWS_ERROR]", error);
        await editProgress(`❌ Terjadi kesalahan: ${error.message}`);
    }
}

// --- HANDLER UNTUK waitState ---
async function handleNewsDetailSelection(sock, msg, text, context) {
    const sender = msg.key.remoteJid;
    const selection = parseInt(text.trim());

    if (isNaN(selection) || selection < 1 || selection > 10) {
        sendMessage(sock, sender, "Pilihan tidak valid. Silakan balas dengan angka dari 1 sampai 10.", { quoted: msg });
        return false; // Tetap dalam waitState
    }

    const selectedNews = context.newsItems[selection - 1];
    if (!selectedNews) {
        sendMessage(sock, sender, "Berita dengan nomor tersebut tidak ditemukan.", { quoted: msg });
        return true; // Hapus waitState
    }

    const detailMsg = await sock.sendMessage(sender, { text: `📖 Memuat detail untuk: "${selectedNews.title}"...` }, { quoted: msg });
    
    try {
        let detailResponse = null;
        // Coba panggil API hingga 3 kali jika gagal
        for (let i = 0; i < 3; i++) {
            try {
                const { data } = await axios.get('https://szyrineapi.biz.id/api/scraper/jkt48/news/detail', {
                    params: { 
                        url: selectedNews.url,
                        ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
                     }
                });
                if (data.status === 200 && data.result.content) {
                    detailResponse = data;
                    break; // Berhasil, keluar dari loop
                }
            } catch (e) {
                if (i === 2) throw e; // Gagal di percobaan terakhir, lempar error
                await delay(1000); // Tunggu 1 detik sebelum mencoba lagi
            }
        }

        if (!detailResponse) throw new Error('Gagal memuat detail berita setelah beberapa kali percobaan.');

        const { title, date, content } = detailResponse.result;
        const formattedContent = `*${title}*\n\n📅 *${date}*\n\n${content}`;
        await editMessage(sock, sender, formattedContent, detailMsg.key);

    } catch (error) {
        await editMessage(sock, sender, `❌ Gagal memuat detail: ${error.message}`, detailMsg.key);
    }

    return true; // Hapus waitState setelah selesai
}