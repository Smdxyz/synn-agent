// modules/fun/banana.js

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Fun';
export const description = 'Mengubah objek di gambar menjadi pisang dengan AI.';
export const usage = `${config.BOT_PREFIX}banana <prompt_opsional>`;
export const aliases = ['nanobanana'];

// --- FUNGSI UTAMA COMMAND ---
export default async function banana(sock, message, args, query, sender, extras) {
    const m = message;
    const jid = m.key.remoteJid;
    
    const media = await H.downloadMedia(m);

    if (!media) {
        return H.sendMessage(sock, jid, '❌ *Gambar tidak ditemukan!*\n\nKirim atau balas gambar dengan caption `!banana <prompt>`', { quoted: m });
    }

    const { buffer, mimetype } = media;
    const prompt = query || 'classic nanobanana effect';
    
    await H.react(sock, jid, m.key, '🍌');
    const sentMsg = await H.sendMessage(sock, jid, '⏳ Menanam pohon pisang...', { quoted: m });
    const messageKey = sentMsg.key;

    try {
        await H.delay(1000);
        await H.editMessage(sock, jid, `🍌 Mengubah gambar dengan prompt: *${prompt}*`, messageKey);

        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        form.append('prompt', prompt);

        const initialResponse = await axios.post('https://szyrineapi.biz.id/api/img/edit/nanobanana', form, {
            headers: form.getHeaders(),
        });

        if (initialResponse.data?.status !== 200 || !initialResponse.data.result?.statusUrl) {
            throw new Error(initialResponse.data.message || 'Gagal memulai proses di API.');
        }

        const { statusUrl } = initialResponse.data.result;
        
        let attempts = 0;
        const maxAttempts = 30;
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