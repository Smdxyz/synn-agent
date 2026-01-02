// modules/ai/imgedit.js

import H from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const name = 'imgedit';
export const aliases = ['editimg', 'flux'];
export const category = 'ai';
export const help = `Mengedit gambar dengan instruksi teks menggunakan model FLUX.

*Cara Penggunaan:*
Balas sebuah gambar dengan perintah:
*.imgedit <instruksi editan>*

*Contoh:*
.imgedit make the sky purple
.imgedit add a cat sitting on the bench
`;

export default async function imgEdit(sock, message, args, query, sender) {
    if (!query) {
        return H.sendMessage(sock, sender, 'Silakan berikan instruksi editan. Contoh: `.imgedit add fireworks in the sky`', { quoted: message });
    }

    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, 'Silakan kirim atau balas sebuah gambar untuk diedit.', { quoted: message });
    }
    
    const { buffer, mimetype } = media;

    await H.react(sock, sender, message.key, '🪄');
    const waitingMsg = await H.sendMessage(sock, sender, `🪄 Menerapkan sihir editan: *"${query}"*...`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('prompt', query);
        form.append('modelName', 'flux-kontext-dev'); // Model default yang cepat

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/image-editor';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job Image Editor.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*🪄 Editan berhasil diterapkan!*`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[IMGEDIT ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal mengedit gambar: ${error.message}`, waitingMsg.key);
    }
}

export const cost = 15;
