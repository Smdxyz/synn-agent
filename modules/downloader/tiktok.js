// /modules/downloaders/tiktok.js

import { config } from '../../config.js';
import { getTikTokPost } from '../../libs/tiktok.js';
import { sendMessage, sendVideo, sendAlbum, editMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh video atau foto (carousel) dari TikTok tanpa watermark.';
export const usage = `${config.BOT_PREFIX}tiktok <url>`;
export const aliases = ['tt', 'ttdl', 'tiktokdl'];

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args, text, sender) {
    const url = args[0];

    if (!url) {
        return sendMessage(sock, sender, `Silakan berikan link TikTok.\n\n*Contoh:*\n\`${config.BOT_PREFIX}tiktok https://vt.tiktok.com/xxxx/\``, { quoted: msg });
    }
    if (!/(?:https?:\/\/)?(?:www\.)?(?:tiktok\.com|vt\.tiktok\.com)\//.test(url)) {
        return sendMessage(sock, sender, `Link yang Anda berikan sepertinya bukan link TikTok yang valid.`, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Memproses link TikTok...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        await editProgress('🔍 Mengekstrak data dari halaman TikTok...');
        const result = await getTikTokPost(url);

        if (!result) {
            throw new Error('Gagal mendapatkan data media dari link tersebut. Mungkin postingan privat atau telah dihapus.');
        }

        const caption = `*Deskripsi:* ${result.description || 'Tidak ada'}\n*Musik:* ${result.music || 'Tidak ada'}\n\nDiunduh oleh ${config.BOT_NAME}`;

        if (result.type === 'Video' && result.videoBuffer) {
            await editProgress('📥 Mengirim video...');
            await sendVideo(sock, sender, result.videoBuffer, caption, { quoted: msg });
            await editProgress('✅ Video berhasil dikirim!');

        } else if (result.type === 'Photo' && result.imageBuffers?.length > 0) {
            await editProgress(`🖼️ Mengirim ${result.imageBuffers.length} foto sebagai album...`);
            
            // Siapkan payload untuk album
            const albumPayload = result.imageBuffers.map((buffer, index) => ({
                image: buffer,
                // Caption hanya ditambahkan di gambar pertama
                caption: (index === 0) ? caption : ''
            }));

            await sendAlbum(sock, sender, albumPayload, { quoted: msg });
            await editProgress(`✅ Album berisi ${result.imageBuffers.length} foto berhasil dikirim!`);
        
        } else {
            throw new Error('Tipe media tidak dikenali atau buffer kosong.');
        }

    } catch (error) {
        console.error("[TIKTOK_ERROR]", error);
        await editProgress(`❌ Terjadi kesalahan: ${error.message}`);
    }
}