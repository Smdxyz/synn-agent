// modules/ai/hdphoto.js

import H from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const name = 'hd';
export const aliases = ['enhance', 'hdphoto'];
export const category = 'ai';
export const help = `Meningkatkan kualitas keseluruhan sebuah foto.

*Cara Penggunaan:*
Kirim atau balas sebuah foto dengan caption *.hd*
`;

export default async function hdPhoto(sock, message, args, query, sender) {
    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, 'Silakan kirim atau balas sebuah foto untuk ditingkatkan kualitasnya.', { quoted: message });
    }

    const { buffer, mimetype } = media;

    await H.react(sock, sender, message.key, '🌟');
    const waitingMsg = await H.sendMessage(sock, sender, `🌟 Memulai proses peningkatan kualitas foto...`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('fidelityLevel', '0.25'); // Nilai default dari dokumentasi

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/photo-enhance';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job Photo Enhance.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*🌟 Foto berhasil ditingkatkan!*`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[HDPHOTO ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal memproses gambar: ${error.message}`, waitingMsg.key);
    }
}