// modules/images/upscale.js

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js'; // Mengimpor semua helper sebagai 'H'
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Meningkatkan resolusi gambar menjadi lebih HD (Upscale).';
export const usage = `${config.BOT_PREFIX}upscale`;
export const aliases = ['hd', 'remini-hd']; // 'remini' diubah untuk menghindari konflik

// --- FUNGSI UTAMA COMMAND ---
export default async function upscale(sock, message, args, query, sender, extras) {
    const m = message; // Alias untuk pesan
    const jid = m.key.remoteJid;

    // Gunakan helper downloadMedia yang baru dan lebih simpel
    const buffer = await H.downloadMedia(m);

    if (!buffer) {
        return H.sendMessage(sock, jid, '❌ *Gambar tidak ditemukan!*\n\nKirim atau balas gambar dengan caption `!upscale`', { quoted: m });
    }
    
    await H.react(sock, jid, m.key, '✨');
    const sentMsg = await H.sendMessage(sock, jid, '⏳ Sedang meningkatkan kualitas gambar Anda...', { quoted: m });
    const messageKey = sentMsg.key;

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg' });

        const response = await axios.post('https://szyrineapi.biz.id/api/images/upscale/imgupscaler', form, {
            headers: form.getHeaders(),
        });

        const result = response.data.result;
        if (response.data.status !== 200 || !result?.success || !result?.result_url) {
            throw new Error(result?.message || 'Gagal mendapatkan hasil dari API.');
        }

        const finalImageUrl = result.result_url;

        await H.sendImage(sock, jid, finalImageUrl, `*✨ Gambar Berhasil Ditingkatkan ✨*\n\n*${config.WATERMARK}*`, false, { quoted: m });
        await H.editMessage(sock, jid, '✅ Sukses!', messageKey);

    } catch (error) {
        console.error("Upscale Command Error:", error);
        const errorMessage = error.response?.data?.message || error.message || "Terjadi kesalahan yang tidak diketahui.";
        await H.editMessage(sock, jid, `❌ Gagal meningkatkan kualitas gambar: ${errorMessage}`, messageKey);
    }
}