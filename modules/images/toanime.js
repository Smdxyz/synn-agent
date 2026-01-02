// modules/images/toanime.js (UPDATED WITH NEW MODELS & ENDPOINT)

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const name = 'toanime';
export const category = 'AI';
export const description = 'Mengubah foto menjadi gaya anime menggunakan berbagai model AI.';
export const usage = `${config.BOT_PREFIX}toanime [model]`;
export const aliases = ['jadianime', 'animefilter'];

// Mapping dari nama simpel ke nama file model di API
const modelMap = {
    'meinamix': 'meinamix_meinaV10.safetensors',
    'meinahentai': 'MeinaHentai_v4.safetensors',
    'astranime': 'AstraAnime_v6.safetensors'
};
const availableModels = Object.keys(modelMap); // ['meinamix', 'meinahentai', 'astranime']

// --- FUNGSI UTAMA COMMAND ---
export default async function toanime(sock, message, args, query, sender) {
    const userModel = (query || 'meinamix').trim().toLowerCase();

    if (!availableModels.includes(userModel)) {
        const helpText = `❌ *Model tidak valid!*\n\nModel yang tersedia:\n- ${availableModels.join('\n- ')}\n\n*Contoh:* .toanime meinamix`;
        return H.sendMessage(sock, sender, helpText, { quoted: message });
    }

    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, '❌ *Gambar tidak ditemukan!*\n\nKirim atau balas gambar dengan caption `.toanime [model]`', { quoted: message });
    }
    
    const { buffer, mimetype } = media;
    const modelNameApi = modelMap[userModel];

    await H.react(sock, sender, message.key, '🎨');
    const waitingMsg = await H.sendMessage(sock, sender, `⏳ Mengubah gambar menjadi anime dengan model *${userModel}*...`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('modelName', modelNameApi);

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/photo-to-anime';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal memulai job To Anime.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*🎨 Hasil Anime 🎨*\n\n*Model:* ${userModel}`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[TOANIME ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal memproses gambar: ${error.message}`, waitingMsg.key);
    }
}

export const cost = 10;
