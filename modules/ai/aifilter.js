// modules/ai/aifilter.js

import H from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const name = 'aifilter';
export const aliases = ['filter'];
export const category = 'ai';
export const help = `Menerapkan filter AI ke gambar.

*Cara Penggunaan:*
Balas sebuah gambar dengan perintah:
*.aifilter <nama_filter>*

*Daftar Filter yang Tersedia:*
- silhouette
- action_figure
- bald
- beardless
- fat
- muscle
- pregnant
- hair_color_changer
- zombie
- werewolf

*Contoh:*
.aifilter zombie
`;

const validFilters = [
    'silhouette', 'action_figure', 'bald', 'beardless', 'fat', 'muscle', 
    'pregnant', 'hair_color_changer', 'zombie', 'werewolf'
];

// --- FUNGSI UTAMA COMMAND ---
export default async function aiFilter(sock, message, args, query, sender) {
    const filterMode = args[0]?.toLowerCase();

    if (!filterMode || !validFilters.includes(filterMode)) {
        return H.sendMessage(sock, sender, `Filter tidak valid. Silakan pilih salah satu dari daftar di bawah ini:\n\n- ${validFilters.join('\n- ')}\n\n*Contoh: .aifilter silhouette*`, { quoted: message });
    }

    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, 'Silakan kirim atau balas sebuah gambar untuk diberi filter.', { quoted: message });
    }
    
    const { buffer, mimetype } = media;

    await H.react(sock, sender, message.key, '🎨');
    const waitingMsg = await H.sendMessage(sock, sender, `⏳ Menerapkan filter *${filterMode}*... Mohon tunggu.`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('filterMode', filterMode);

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/ai-filter';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job AI Filter.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*🎨 Filter:* ${filterMode}\n*Model:* Pixnova AI`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[AIFILTER ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal menerapkan filter: ${error.message}`, waitingMsg.key);
    }
}

export const cost = 15;
