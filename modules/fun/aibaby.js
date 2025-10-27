// modules/fun/aibaby.js (VERSI LENGKAP & PERBAIKAN ALUR + ANIMASI)

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Fun';
export const description = 'Memprediksi wajah bayi dari foto Ayah dan Ibu.';
export const usage = `${config.BOT_PREFIX}aibaby [boy/girl]`;
export const aliases = ['jadibayi', 'babygenerator'];


/**
 * Fungsi ini menangani pesan kedua (gambar Ibu) dari pengguna.
 */
async function handleMotherImage(sock, message, text, context) {
    const jid = message.key.remoteJid;
    const { fatherMedia, gender, originalMessage } = context;

    // Gunakan helper untuk mengunduh gambar Ibu
    const motherMedia = await H.downloadMedia(message);

    if (!motherMedia) {
        await H.sendMessage(sock, jid, "❌ Anda harus mengirimkan gambar calon Ibu. Silakan kirim ulang gambarnya.", { quoted: message });
        return false; // Jangan hapus state, biarkan pengguna mencoba lagi
    }

    await H.react(sock, jid, message.key, '👩');
    const sentMsg = await H.sendMessage(sock, jid, '⏳ Kedua foto diterima. Menganalisa genetik...', { quoted: message });
    const messageKey = sentMsg.key;

    try {
        await H.delay(1500);
        await H.editMessage(sock, jid, '👶 Memprediksi wajah bayi... Ini mungkin perlu waktu.', messageKey);

        const form = new FormData();
        // PERBAIKAN: Sertakan mimetype untuk kedua gambar
        form.append('father', fatherMedia.buffer, { filename: 'father.jpg', contentType: fatherMedia.mimetype });
        form.append('mother', motherMedia.buffer, { filename: 'mother.jpg', contentType: motherMedia.mimetype });
        form.append('gender', gender);

        const { data: jobData } = await axios.post('https://szyrineapi.biz.id/api/img/pixnova/ai-baby', form, { 
            headers: form.getHeaders() 
        });

        if (jobData?.status !== 200 || !jobData.result?.statusUrl) {
            throw new Error(jobData.message || 'Gagal memulai proses di API.');
        }

        const finalImageUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        if (finalImageUrl) {
            await H.sendImage(sock, jid, finalImageUrl, `*👶 Prediksi Bayi Anda 👶*\n\n*Gender:* ${gender}\n\n*${config.WATERMARK}*`, false, { quoted: originalMessage });
            await H.editMessage(sock, jid, '✅ Sukses!', messageKey);
        } else {
            throw new Error('Waktu pemrosesan habis (timeout).');
        }
    } catch (error) {
        console.error("AI Baby (Handler) Error:", error);
        const errorMessage = error.response?.data?.message || error.message || "Terjadi kesalahan.";
        await H.editMessage(sock, jid, `❌ Gagal memproses gambar: ${errorMessage}`, messageKey);
    }
    
    return true; // Hapus state karena proses selesai
}


// --- FUNGSI UTAMA COMMAND (LANGKAH PERTAMA) ---
export default async function aibaby(sock, message, args, query, sender, extras) {
    const jid = message.key.remoteJid;
    
    const helpText = `❌ *Perintah salah!*\n\nIkuti 2 langkah ini:\n\n*1.* Kirim foto calon *Ayah* dengan caption:\n\`!aibaby boy\` atau \`!aibaby girl\`\n\n*2.* Setelah itu, kirim foto calon *Ibu*.`;

    const gender = query.trim().toLowerCase();
    if (gender !== 'boy' && gender !== 'girl') {
        return H.sendMessage(sock, jid, '❌ *Gender tidak valid!*\n\nGunakan format:\n`!aibaby boy` atau `!aibaby girl`', { quoted: message });
    }

    // PERBAIKAN: Download media sebagai objek { buffer, mimetype }
    const fatherMedia = await H.downloadMedia(message);
    if (!fatherMedia) {
        return H.sendMessage(sock, jid, '❌ *Gambar tidak ditemukan!*\n\nAnda harus menyertakan gambar calon Ayah pada perintah pertama.', { quoted: message });
    }

    try {
        await H.react(sock, jid, message.key, '👨');

        // Atur bot ke mode "menunggu gambar Ibu"
        extras.set(sender, 'aibaby', {
            handler: handleMotherImage,
            context: {
                fatherMedia: fatherMedia, // Simpan seluruh objek media
                gender: gender,
                originalMessage: message
            },
            timeout: 300000 // Beri waktu 5 menit
        });

        return H.sendMessage(sock, jid, '✅ Foto Ayah diterima.\n\nSekarang, silakan kirim foto calon *Ibu* untuk memulai proses.', { quoted: message });

    } catch (error) {
        console.error("AI Baby (Initial) Error:", error);
        return H.sendMessage(sock, jid, '❌ Gagal memproses foto Ayah. Coba lagi.', { quoted: message });
    }
}