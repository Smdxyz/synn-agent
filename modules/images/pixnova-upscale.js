// modules/images/pixnova-upscale.js

import { sendMessage, react, downloadMedia, sendImage, pollPixnovaJob, editMessage, delay } from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';
import { config } from '../../config.js'; // Impor config untuk prefix

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Meningkatkan resolusi gambar (2x atau 4x) menggunakan model Pixnova.';
export const usage = `${config.BOT_PREFIX}pixnova-upscale [2|4]`;
export const aliases = ['pixnova', 'upscalepix'];

// --- FUNGSI UTAMA COMMAND ---
export default async function pixnovaUpscale(sock, message, args, query, sender) {
  const media = await downloadMedia(message);
  
  if (!media) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar untuk di-upscale menggunakan Pixnova.', { quoted: message });
  }

  const { buffer, mimetype } = media;
  const scale = args[0] && ['2', '4'].includes(args[0]) ? args[0] : '2';

  await react(sock, sender, message.key, '🚀');
  const sentMsg = await sendMessage(sock, sender, `⏳ Menyiapkan mesin Pixnova...`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    await delay(1000);
    await editMessage(sock, sender, `🚀 Memulai proses upscale *${scale}x*... Ini mungkin butuh waktu.`, messageKey);

    const form = new FormData();
    form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
    form.append('scale', scale);

    const { data: jobData } = await axios.post('https://szyrineapi.biz.id/api/img/pixnova/image-upscale', form, { 
      headers: form.getHeaders() 
    });

    if (!jobData.result?.statusUrl) {
      throw new Error(jobData.message || 'Gagal membuat job upscale.');
    }

    const finalUrl = await pollPixnovaJob(jobData.result.statusUrl);
    
    await sendImage(sock, sender, finalUrl, `*🚀 Gambar berhasil di-upscale ${scale}x!*`, false, { quoted: message });
    await editMessage(sock, sender, '✅ Selesai!', messageKey);

  } catch (error) {
    console.error("[PIXNOVA UPSCALE] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal memproses gambar.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}

export const cost = 10;
