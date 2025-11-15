// modules/ai/remini.js

import H from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const name = 'remini';
export const aliases = ['restore', 'hdblur', 'airbrush'];
export const category = 'ai';
export const help = `Merestorasi foto lama atau buram menjadi lebih jernih (Mirip Remini).

*Cara Penggunaan:*
Kirim atau balas sebuah foto dengan caption *.remini*
`;

// --- FUNGSI UTAMA COMMAND ---
export default async function remini(sock, message, args, query, sender) {
    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, 'Gambar mana yang mau direstorasi, hah?! Kirim atau balas fotonya!', { quoted: message });
    }

    const { buffer, mimetype } = media;

    await H.react(sock, sender, message.key, '🛠️');
    const waitingMsg = await H.sendMessage(sock, sender, `⏳ Memulai restorasi foto... Sabar, jangan rewel.`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });

        const apiUrl = 'https://szyrineapi.biz.id/api/img/edit/airbrush-restore';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job restorasi. API-nya lagi ngambek mungkin.');
        }
        
        const statusUrl = jobData.result.statusUrl;
        
        // --- POLLING LOGIC KHUSUS UNTUK RESPON BUFFER ---
        let finalImageBuffer = null;
        for (let i = 0; i < 20; i++) { // Coba maksimal 20 kali
            await H.sleep(3000); // Tunggu 3 detik setiap kali coba
            const statusResponse = await axios.get(statusUrl);
            const resultData = statusResponse.data.result;

            if (resultData?.status === 'completed') {
                // INI BAGIAN PENTINGNYA, TOLOL!
                // Ubah array data dari JSON menjadi Buffer gambar
                if (resultData.result?.type === 'buffer' && Array.isArray(resultData.result.data)) {
                    finalImageBuffer = Buffer.from(resultData.result.data);
                    break; // Keluar dari loop karena sudah berhasil
                } else {
                    throw new Error('Format hasil tidak sesuai, harusnya buffer.');
                }
            } else if (resultData?.status === 'failed') {
                throw new Error(resultData.message || 'Proses restorasi gagal di server.');
            }
            // Jika masih 'processing', loop akan lanjut
        }

        if (finalImageBuffer) {
            await H.sendImage(sock, sender, finalImageBuffer, `*✨ Foto berhasil direstorasi!*`, false, { quoted: message });
            await sock.sendMessage(sender, { delete: waitingMsg.key });
        } else {
            throw new Error('Waktu pemrosesan habis (timeout). Coba lagi nanti!');
        }

    } catch (error) {
        console.error(`[REMINI ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal total: ${error.message}`, waitingMsg.key);
    }
}