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
    const { sourceBuffer, originalMessage } = context; // Ambil buffer gambar pertama

    // Gunakan helper untuk mengunduh gambar kedua (wajah)
    const faceBuffer = await H.downloadMedia(message);
    
    if (!faceBuffer) {
        await H.sendMessage(sock, jid, "❌ Anda harus mengirimkan gambar wajah. Silakan kirim ulang gambarnya.", { quoted: message });
        return false; // Jangan hapus state, biarkan pengguna mencoba lagi
    }

    const sentMsg = await H.sendMessage(sock, jid, '⏳ Kedua gambar diterima. Sedang menukar wajah...', { quoted: message });
    const messageKey = sentMsg.key;

    try {
        const form = new FormData();
        form.append('source', sourceBuffer, { filename: 'source.jpg' });
        form.append('face', faceBuffer, { filename: 'face.jpg' });

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

    // Gunakan helper untuk mengunduh gambar pertama (sumber)
    const sourceBuffer = await H.downloadMedia(message);
    
    if (!sourceBuffer) {
        return H.sendMessage(sock, jid, '❌ *Perintah salah!*\n\nKirim gambar *sumber* (yang ingin ditempeli wajah) dengan caption `!faceswap`.', { quoted: message });
    }

    try {
        await H.react(sock, jid, message.key, '1️⃣');
        
        // Atur bot ke mode "menunggu gambar kedua"
        extras.set(sender, 'faceswap', {
            handler: handleFaceImage,
            context: { 
                sourceBuffer: sourceBuffer,
                originalMessage: message // Simpan pesan asli untuk di-quote nanti
            },
            timeout: 120000 // Beri waktu 2 menit
        });

        await H.sendMessage(sock, jid, '✅ Gambar sumber diterima. Sekarang, silakan kirim gambar *wajah* untuk ditempelkan.', { quoted: message });

    } catch (error) {
        console.error("FaceSwap Command Error (initial):", error);
        await H.sendMessage(sock, jid, '❌ Gagal memproses gambar pertama. Coba lagi.', { quoted: message });
    }
}