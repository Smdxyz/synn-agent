// modules/ai/imgtranslate.js

import H from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const name = 'imgtranslate';
export const aliases = ['trimg', 'translateto'];
export const category = 'ai';
export const help = `Menerjemahkan teks yang ada di dalam gambar.

*Cara Penggunaan:*
Balas sebuah gambar dengan perintah:
*.trimg <kode_bahasa>*

Jika kode bahasa tidak diberikan, akan otomatis diterjemahkan ke Bahasa Indonesia (id).

*Contoh:*
- .trimg en (Terjemahkan ke Inggris)
- .trimg ja (Terjemahkan ke Jepang)
- .trimg (Terjemahkan ke Indonesia)
`;

// --- FUNGSI UTAMA COMMAND ---
export default async function imgTranslate(sock, message, args, query, sender) {
    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, 'Silakan kirim atau balas sebuah gambar yang berisi teks untuk diterjemahkan.', { quoted: message });
    }

    const targetLang = args[0]?.toLowerCase() || 'id';
    const { buffer, mimetype } = media;

    await H.react(sock, sender, message.key, '🌐');
    const waitingMsg = await H.sendMessage(sock, sender, `🔍 Menganalisis teks dan menerjemahkan ke [${targetLang}]...`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('targetLang', targetLang);

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/image-translate';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job Image Translate.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*🌐 Terjemahan ke [${targetLang}] berhasil!*`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[IMGTRANSLATE ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal menerjemahkan gambar: ${error.message}`, waitingMsg.key);
    }
}