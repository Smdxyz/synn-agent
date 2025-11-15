// modules/ai/blur.js

import H from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const name = 'blur';
export const aliases = ['blurbg', 'blurbackground'];
export const category = 'ai';
export const help = `Membuat efek blur (bokeh) pada latar belakang foto.

*Cara Penggunaan:*
Kirim atau balas sebuah foto dengan caption *.blur*
`;

// --- FUNGSI UTAMA COMMAND ---
export default async function blurBackground(sock, message, args, query, sender) {
    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, 'Kirim atau balas gambar dulu.', { quoted: message });
    }

    const { buffer, mimetype } = media;

    await H.react(sock, sender, message.key, '💧');
    const waitingMsg = await H.sendMessage(sock, sender, `💧 Menganalisis subjek dan latar belakang...`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/blur-background';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job Blur Background.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*💧 Latar belakang berhasil dibuat blur!*`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[BLURBG ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal: ${error.message}`, waitingMsg.key);
    }
}