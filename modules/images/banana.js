// modules/fun/banana.js

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js'; // Mengimpor semua helper sebagai 'H'
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Fun';
export const description = 'Mengubah objek di gambar menjadi pisang dengan AI.';
export const usage = `${config.BOT_PREFIX}banana <prompt_opsional>`;
export const aliases = ['nanobanana'];

// --- FUNGSI UTAMA COMMAND ---
export default async function banana(sock, message, args, query, sender, extras) {
    const m = message; // Alias untuk pesan
    const jid = m.key.remoteJid;
    
    // Gunakan helper downloadMedia yang lebih cerdas
    const buffer = await H.downloadMedia(m);

    if (!buffer) {
        return H.sendMessage(sock, jid, '❌ *Gambar tidak ditemukan!*\n\nKirim atau balas gambar dengan caption `!banana <prompt>`', { quoted: m });
    }

    const prompt = query || 'classic nanobanana effect'; // Prompt default jika tidak diberikan
    
    await H.react(sock, jid, m.key, '🍌');
    const sentMsg = await H.sendMessage(sock, jid, '⏳ Sedang memproses gambar Anda menjadi pisang...', { quoted: m });
    const messageKey = sentMsg.key;

    try {
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg' });
        form.append('prompt', prompt);

        const initialResponse = await axios.post('https://szyrineapi.biz.id/api/img/edit/nanobanana', form, {
            headers: form.getHeaders(),
        });

        if (initialResponse.data?.status !== 200 || !initialResponse.data.result?.statusUrl) {
            throw new Error(initialResponse.data.message || 'Gagal memulai proses di API.');
        }

        const { statusUrl } = initialResponse.data.result;
        
        let attempts = 0;
        const maxAttempts = 30; // Timeout ~2 menit
        let finalImageUrl = null;

        while (attempts < maxAttempts) {
            await H.delay(4000); 

            const statusResponse = await axios.get(statusUrl);
            const resultData = statusResponse.data.result;

            if (resultData.status === 'completed') {
                finalImageUrl = resultData.result.url;
                break; 
            } else if (resultData.status === 'failed') {
                throw new Error('API gagal memproses gambar Anda.');
            }
            
            await H.editMessage(sock, jid, `⏳ Pisangnya masih dimasak... (${attempts + 1}/${maxAttempts})`, messageKey);
            attempts++;
        }

        if (finalImageUrl) {
            await H.sendImage(sock, jid, finalImageUrl, `*🍌 NanoBanana Result 🍌*\n\n*Prompt:* ${prompt}\n\n*${config.WATERMARK}*`, false, { quoted: m });
            await H.editMessage(sock, jid, `✅ Sukses!`, messageKey);
        } else {
            throw new Error('Waktu pemrosesan habis (timeout).');
        }

    } catch (error) {
        console.error("Banana Command Error:", error);
        const errorMessage = error.response?.data?.message || error.message || "Terjadi kesalahan yang tidak diketahui.";
        await H.editMessage(sock, jid, `❌ Gagal memproses gambar: ${errorMessage}`, messageKey);
    }
}