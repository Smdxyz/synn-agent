// /modules/info/jkt48.js (REMASTERED & FIXED)

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, editMessage, react, delay } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Info';
export const description = 'Menampilkan berita atau jadwal terbaru JKT48.';
export const usage = `${config.BOT_PREFIX}jkt48 <news|schedule>`;
export const aliases = ['jktnews', 'jktschedule'];

// --- FUNGSI PENGAMBILAN DATA ---

async function fetchNewsList() {
    for (let i = 0; i < 5; i++) {
        try {
            const { data } = await axios.get(`https://szyrineapi.biz.id/api/tools/news/jkt48?apikey=${config.SZYRINE_API_KEY}`);
            if (data?.status === 200 && data.result?.length > 0) return data.result;
        } catch (e) {
            if (i === 4) throw e;
            await delay(1000);
        }
    }
    throw new Error('Gagal mengambil daftar berita setelah beberapa kali percobaan.');
}

async function fetchDetail(url) {
    const { data } = await axios.get(`https://szyrineapi.biz.id/api/tools/news/jkt48/detail?url=${encodeURIComponent(url)}&apikey=${config.SZYRINE_API_KEY}`);
    if (data?.status === 200 && data.result) return data.result;
    throw new Error('Gagal mengambil detail.');
}

// --- HANDLER UNTUK INTERAKSI (WAITSTATE) ---
async function handleSelection(sock, msg, text, context) {
    const sender = msg.key.remoteJid;
    const selection = parseInt(text.trim(), 10);
    const { items, type } = context;

    if (isNaN(selection) || selection < 1 || selection > items.length) {
        sendMessage(sock, sender, "Pilihan tidak valid. Balas dengan nomor yang sesuai.", { quoted: msg });
        return false;
    }

    const selectedItem = items[selection - 1];
    const detailMsg = await sendMessage(sock, sender, `📖 Memuat detail untuk: *"${selectedItem.title}"*...`, { quoted: msg });

    try {
        const detail = await fetchDetail(selectedItem.url);
        let detailText = `*${detail.title}*\n\n`;
        if (type === 'news') {
            detailText += `📅 *${detail.date}*\n\n${detail.content}`;
        } else if (type === 'schedule') {
            detailText += `🗓️ *${detail.datetime}*\n\n*Member Partisipasi:*\n- ${detail.members.join('\n- ')}`;
        }
        await editMessage(sock, sender, detailText, detailMsg.key);
    } catch (error) {
        await editMessage(sock, sender, `❌ Gagal memuat detail: ${error.message}`, detailMsg.key);
    }
    return true;
}

// --- FUNGSI UTAMA COMMAND ---
export default async function jkt48(sock, msg, args, query, sender, extras) {
    const subCommand = (args[0] || '').toLowerCase();

    if (!['news', 'schedule'].includes(subCommand)) {
        return sendMessage(sock, sender, `Perintah tidak lengkap.\n\nGunakan:\n- \`${config.BOT_PREFIX}jkt48 news\`\n- \`${config.BOT_PREFIX}jkt48 schedule\``, { quoted: msg });
    }

    const progressMsg = await sendMessage(sock, sender, `Mengambil data *${subCommand}* terbaru dari JKT48...`, { quoted: msg });

    try {
        let items, title;
        if (subCommand === 'news') {
            items = await fetchNewsList();
            title = '📰 Berita Terbaru JKT48';
        } else {
            const { data } = await axios.get(`https://szyrineapi.biz.id/api/tools/news/jkt48/schedule?apikey=${config.SZYRINE_API_KEY}`);
            items = data.result;
            title = '🗓️ Jadwal JKT48 Mendatang';
        }
        
        if (!items || items.length === 0) throw new Error('Tidak ada data yang ditemukan.');

        // ================== PERUBAHAN DI SINI ==================
        // Mengubah dari Carousel menjadi Teks Biasa
        const itemsToShow = items.slice(0, 10);
        let listText = `*${title}*\n\n`;
        itemsToShow.forEach((item, index) => {
            listText += `*${index + 1}.* ${item.title}\n  └ 📅 ${item.date}\n\n`;
        });
        listText += `Balas dengan nomor (1-${itemsToShow.length}) untuk melihat detail. Waktu 60 detik.`;

        await editMessage(sock, sender, listText, progressMsg.key);
        // =======================================================

        extras.set(sender, 'jkt48_detail', {
            timeout: 60000,
            context: { items: itemsToShow, type: subCommand },
            handler: handleSelection,
        });

    } catch (error) {
        console.error("[JKT48 COMMAND ERROR]", error);
        await editMessage(sock, sender, `❌ Terjadi kesalahan: ${error.message}`, progressMsg.key);
    }
}