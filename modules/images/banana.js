// modules/fun/banana.js (REFACTORED TO USE PIXNOVA EDITOR)

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const name = 'banana';
export const category = 'Fun';
export const description = 'Menggunakan AI untuk mengubah objek di gambar menjadi pisang.';
export const usage = `${config.BOT_PREFIX}banana <prompt_opsional>`;
export const aliases = ['nanobanana'];

// --- FUNGSI UTAMA COMMAND ---
export default async function banana(sock, message, args, query, sender) {
    const media = await H.downloadMedia(message);

    if (!media) {
        return H.sendMessage(sock, sender, '❌ *Gambar tidak ditemukan!*\n\nKirim atau balas gambar dengan caption `.banana`', { quoted: message });
    }

    const { buffer, mimetype } = media;
    // Prompt default untuk efek pisang yang lebih baik
    const prompt = query || 'turn the main subject of the image into a ripe banana, keep the background';
    
    await H.react(sock, sender, message.key, '🍌');
    const waitingMsg = await H.sendMessage(sock, sender, `⏳ Menggunakan FLUX Engine untuk membuat pisang...`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('prompt', prompt);
        // Menggunakan model editor FLUX default
        form.append('modelName', 'flux-kontext-dev');

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/image-editor';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job image editor.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*🍌 NanoBanana v2 (FLUX)*\n\n*Prompt:* ${prompt}`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[BANANA ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal membuat pisang: ${error.message}`, waitingMsg.key);
    }
}