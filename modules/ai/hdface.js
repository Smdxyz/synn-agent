// modules/ai/hdface.js

import H from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const name = 'hdface';
export const aliases = ['enhanceface', 'facehd'];
export const category = 'ai';
export const help = `Meningkatkan kualitas dan kejernihan wajah pada foto.

*Cara Penggunaan:*
Kirim atau balas sebuah foto dengan caption *.hdface*
`;

// --- FUNGSI UTAMA COMMAND ---
export default async function hdFace(sock, message, args, query, sender) {
    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, 'Silakan kirim atau balas sebuah foto untuk ditingkatkan kualitas wajahnya.', { quoted: message });
    }

    const { buffer, mimetype } = media;

    await H.react(sock, sender, message.key, '✨');
    const waitingMsg = await H.sendMessage(sock, sender, `✨ Menganalisis wajah dan memulai proses peningkatan kualitas...`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('creativeValue', '0.1'); // Nilai default yang baik untuk hasil natural

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/face-enhance';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job Face Enhance.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*✨ Wajah berhasil ditingkatkan kualitasnya!*`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[HDFACE ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal memproses gambar: ${error.message}`, waitingMsg.key);
    }
}