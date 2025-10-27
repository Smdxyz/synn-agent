// modules/images/toanime.js

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js'; // Kita akan panggil H.downloadMedia
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Mengubah gambar wajah menjadi style anime menggunakan AI.';
export const usage = `${config.BOT_PREFIX}toanime [model]`;
export const aliases = ['jadianime', 'animefilter'];

// --- FUNGSI UTAMA COMMAND ---
export default async function toanime(sock, message, args, query, sender, extras) {
    const jid = message.key.remoteJid;

    // Cek media menggunakan helper baru
    const buffer = await H.downloadMedia(message);
    
    // Daftar model yang valid
    const availableModels = ['anime', 'meinahentai', 'astranime'];
    
    // Tentukan model yang dipilih pengguna, atau gunakan default 'anime'
    let model = 'anime'; // Model default
    const userModel = query.trim().toLowerCase();

    // Validasi model
    if (userModel && !availableModels.includes(userModel)) {
        const helpText = `❌ *Model tidak valid!*\n\nModel yang tersedia:\n- ${availableModels.join('\n- ')}\n\nContoh: \`${usage}\``;
        return H.sendMessage(sock, jid, helpText, { quoted: message });
    } else if (availableModels.includes(userModel)) {
        model = userModel;
    }

    // Jika tidak ada gambar sama sekali
    if (!buffer) {
        const helpText = `❌ *Gambar tidak ditemukan!*\n\nKirim atau balas gambar dengan caption:\n\`${usage}\`\n\n*Model Opsional:*\n- anime (default)\n- meinahentai\n- astranime`;
        return H.sendMessage(sock, jid, helpText, { quoted: message });
    }

    await H.react(sock, jid, message.key, '🎨');
    const sentMsg = await H.sendMessage(sock, jid, `⏳ Mengubah gambar Anda menjadi anime dengan model *${model}*...`, { quoted: message });
    const messageKey = sentMsg.key;

    try {
        // ---- LANGKAH 1: KIRIM JOB KE API ----
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg' });
        form.append('model', model);

        const initialResponse = await axios.post('https://szyrineapi.biz.id/api/img/pixnova/img2anime', form, {
            headers: form.getHeaders(),
        });

        if (initialResponse.data?.status !== 200 || !initialResponse.data.result?.statusUrl) {
            throw new Error('Gagal memulai proses di API. Coba lagi nanti.');
        }
        
        const { statusUrl } = initialResponse.data.result;

        // ---- LANGKAH 2: POLLING (CEK STATUS) ----
        const finalImageUrl = await H.pollPixnovaJob(statusUrl); // Gunakan helper yang sudah ada

        // ---- LANGKAH 3: KIRIM HASIL ----
        if (finalImageUrl) {
            await H.sendImage(sock, jid, finalImageUrl, `*🎨 Hasil Anime 🎨*\n\n*Model:* ${model}\n\n*${config.WATERMARK}*`, false, { quoted: message });
            await H.editMessage(sock, jid, '✅ Sukses!', messageKey);
        } else {
            // pollPixnovaJob akan throw error jika timeout, jadi blok ini mungkin tidak tereksekusi
            throw new Error('Waktu pemrosesan habis (timeout). Silakan coba lagi.');
        }

    } catch (error) {
        console.error("ToAnime Command Error:", error);
        const errorMessage = error.response?.data?.message || error.message || "Terjadi kesalahan yang tidak diketahui.";
        await H.editMessage(sock, jid, `❌ Gagal memproses gambar: ${errorMessage}`, messageKey);
    }
}