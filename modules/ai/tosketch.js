// modules/ai/tosketch.js

import H from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const name = 'tosketch';
export const aliases = ['sketch', 'jadisketsa'];
export const category = 'ai';
export const help = `Mengubah foto menjadi gambar sketsa.

*Cara Penggunaan:*
Kirim atau balas sebuah foto dengan caption *.tosketch*
`;

// --- FUNGSI UTAMA COMMAND ---
export default async function toSketch(sock, message, args, query, sender) {
    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, 'Kirim atau balas gambar dulu.', { quoted: message });
    }

    const { buffer, mimetype } = media;

    await H.react(sock, sender, message.key, '✏️');
    const waitingMsg = await H.sendMessage(sock, sender, `✏️ Menggambar sketsa dari fotomu...`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/image-to-sketch';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job Sketsa.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*✏️ Ini dia hasil sketsanya!*`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[TOSKETCH ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal: ${error.message}`, waitingMsg.key);
    }
}

export const cost = 15;
