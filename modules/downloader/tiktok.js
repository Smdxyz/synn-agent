// /modules/downloaders/tiktok.js (FINAL - MENGGUNAKAN SCRAPER & DOWNLOADER BARU)

import { config } from '../../config.js';
import { getTikTokPost } from '../../libs/tiktok.js'; // <-- Impor fungsi baru kita
import { sendMessage, sendVideo, sendAlbum, editMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh video atau foto (slideshow) dari TikTok tanpa watermark.';
export const usage = `${config.BOT_PREFIX}tiktok <url>`;
export const aliases = ['tt', 'ttdl', 'tiktokdl'];

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args) {
    const url = args[0];
    const sender = msg.key.remoteJid;

    if (!url || !/(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com|vt\.tiktok\.com)\//.test(url)) {
        return sendMessage(sock, sender, `Link yang Anda berikan sepertinya bukan link TikTok yang valid.`, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Memproses link TikTok... (menggunakan scraper v2)` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        await editProgress('🔍 Mengekstrak data dari halaman TikTok...');
        const result = await getTikTokPost(url); // <-- Cukup panggil fungsi ini

        if (!result) {
            throw new Error('Gagal mendapatkan data media dari link tersebut. Mungkin postingan privat, dihapus, atau scraper diblokir.');
        }

        const caption = `*Deskripsi:* ${result.description || 'Tidak ada'}\n*Musik:* ${result.music?.title || 'Tidak ada'}\n\nDiunduh oleh ${config.BOT_NAME}`;

        if (result.type === 'video' && result.videoBuffer) {
            await editProgress('📥 Mengirim video...');
            await sendVideo(sock, sender, result.videoBuffer, caption, { quoted: msg });
            await editProgress('✅ Video berhasil dikirim!');

        } else if (result.type === 'image' && result.imageBuffers?.length > 0) {
            await editProgress(`🖼️ Mengirim ${result.imageBuffers.length} foto sebagai album...`);
            
            const albumPayload = result.imageBuffers.map((buffer, index) => ({
                image: buffer,
                caption: (index === 0) ? caption : ''
            }));

            await sendAlbum(sock, sender, albumPayload, { quoted: msg });
            await editProgress(`✅ Album berisi ${result.imageBuffers.length} foto berhasil dikirim!`);
        
        } else {
            throw new Error('Tipe media tidak dikenali atau buffer kosong setelah diproses.');
        }

    } catch (error) {
        console.error("[TIKTOK_V2_ERROR]", error);
        await editProgress(`❌ Terjadi kesalahan: ${error.message}`);
    }
}

export const cost = 5;
