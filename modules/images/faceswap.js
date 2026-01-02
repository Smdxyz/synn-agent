// modules/images/faceswap.js

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Fun';
export const description = 'Menukar wajah dari satu gambar ke gambar lain.';
export const usage = `${config.BOT_PREFIX}faceswap`;
export const aliases = ['swapface', 'timpa'];

/**
 * Fungsi ini menangani pesan kedua (gambar wajah) dari pengguna.
 */
async function handleFaceImage(sock, message, text, context) {
    const jid = message.key.remoteJid;
    const { sourceMedia, originalMessage } = context; // Ambil media gambar pertama

    const faceMedia = await H.downloadMedia(message);
    
    if (!faceMedia) {
        await H.sendMessage(sock, jid, "❌ Anda harus mengirimkan gambar wajah. Silakan kirim ulang gambarnya.", { quoted: message });
        return false; // Jangan hapus state, biarkan pengguna mencoba lagi
    }

    const sentMsg = await H.sendMessage(sock, jid, '⏳ Kedua gambar diterima. Mempersiapkan operasi...', { quoted: message });
    const messageKey = sentMsg.key;

    try {
        await H.delay(1000);
        await H.editMessage(sock, jid, `🎭 Menukar wajah... Ini mungkin perlu waktu.`, messageKey);

        const form = new FormData();
        form.append('source', sourceMedia.buffer, { filename: 'source.jpg', contentType: sourceMedia.mimetype });
        form.append('face', faceMedia.buffer, { filename: 'face.jpg', contentType: faceMedia.mimetype });

        const { data: jobData } = await axios.post('https://szyrineapi.biz.id/api/img/pixnova/faceswap', form, {
            headers: form.getHeaders(),
        });

        if (jobData?.status !== 200 || !jobData.result?.statusUrl) {
            throw new Error(jobData.message || 'Gagal memulai proses di API.');
        }
        
        const finalImageUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        if (finalImageUrl) {
            await H.sendImage(sock, jid, finalImageUrl, `*🎭 Wajah Berhasil Ditukar 🎭*\n\n*${config.WATERMARK}*`, false, { quoted: originalMessage });
            await H.editMessage(sock, jid, '✅ Sukses!', messageKey);
        } else {
            throw new Error('Waktu pemrosesan habis (timeout).');
        }
    } catch (error) {
        console.error("FaceSwap Command Error (handler):", error);
        const errorMessage = error.response?.data?.message || error.message || "Terjadi kesalahan.";
        await H.editMessage(sock, jid, `❌ Gagal memproses gambar: ${errorMessage}`, messageKey);
    }

    return true; // Hapus state karena proses sudah selesai
}


// --- FUNGSI UTAMA COMMAND (LANGKAH PERTAMA) ---
export default async function faceswap(sock, message, args, query, sender, extras) {
    const jid = message.key.remoteJid;

    const sourceMedia = await H.downloadMedia(message);
    
    if (!sourceMedia) {
        return H.sendMessage(sock, jid, '❌ *Perintah salah!*\n\nKirim gambar *sumber* (yang ingin ditempeli wajah) dengan caption `!faceswap`.', { quoted: message });
    }

    try {
        await H.react(sock, jid, message.key, '1️⃣');
        
        extras.set(sender, 'faceswap', {
            handler: handleFaceImage,
            context: { 
                sourceMedia: sourceMedia, // Simpan seluruh objek media
                originalMessage: message
            },
            timeout: 120000
        });

        await H.sendMessage(sock, jid, '✅ Gambar sumber diterima. Sekarang, silakan kirim gambar *wajah* untuk ditempelkan.', { quoted: message });

    } catch (error) {
        console.error("FaceSwap Command Error (initial):", error);
        await H.sendMessage(sock, jid, '❌ Gagal memproses gambar pertama. Coba lagi.', { quoted: message });
    }
}

export const cost = 10;
