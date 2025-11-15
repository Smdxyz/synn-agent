// modules/ai/changeclothes.js

import H from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const name = 'changeclothes';
export const aliases = ['gantibaju', 'restyle'];
export const category = 'ai';
export const help = `Mengubah pakaian di gambar menggunakan deskripsi teks.

*Cara Penggunaan:*
Balas sebuah gambar dengan perintah:
*.gantibaju <deskripsi pakaian>*

*Contoh:*
.gantibaju kemeja batik lengan panjang
.gantibaju gaun malam berwarna merah
`;

export default async function changeClothes(sock, message, args, query, sender) {
    if (!query) {
        return H.sendMessage(sock, sender, 'Silakan berikan deskripsi pakaian yang baru. Contoh: `.gantibaju jaket kulit hitam`', { quoted: message });
    }

    const media = await H.downloadMedia(message);
    if (!media) {
        return H.sendMessage(sock, sender, 'Silakan kirim atau balas sebuah gambar orang untuk diganti pakaiannya.', { quoted: message });
    }
    
    const { buffer, mimetype } = media;

    await H.react(sock, sender, message.key, '👕');
    const waitingMsg = await H.sendMessage(sock, sender, `🎨 Mendesain pakaian baru: *"${query}"*...`, { quoted: message });

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('prompt', query);

        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/change-clothes';
        const { data: jobData } = await axios.post(apiUrl, form, { headers: form.getHeaders() });

        if (!jobData.result?.statusUrl) {
            throw new Error(jobData.result?.message || 'Gagal membuat job Change Clothes.');
        }

        const finalUrl = await H.pollPixnovaJob(jobData.result.statusUrl);

        await H.sendImage(sock, sender, finalUrl, `*👕 Pakaian berhasil diubah!*`, false, { quoted: message });
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[CHANGECLOTHES ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal mengubah pakaian: ${error.message}`, waitingMsg.key);
    }
}