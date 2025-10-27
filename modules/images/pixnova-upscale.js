// modules/images/pixnova-upscale.js

import { sendMessage, react, downloadMedia, sendImage, pollPixnovaJob, editMessage } from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Meningkatkan resolusi gambar (2x atau 4x) menggunakan model Pixnova.';
export const usage = `${process.env.BOT_PREFIX || '!'}pixnova-upscale [2|4]`;
export const aliases = ['pixnova', 'upscalepix'];

// --- FUNGSI UTAMA COMMAND ---
export default async function pixnovaUpscale(sock, message, args, query, sender) {
  const imageBuffer = await downloadMedia(message);
  
  if (!imageBuffer) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar untuk di-upscale menggunakan Pixnova.', { quoted: message });
  }

  // Ambil skala dari argumen, default '2' jika tidak valid
  const scale = args[0] && ['2', '4'].includes(args[0]) ? args[0] : '2';

  await react(sock, sender, message.key, '🚀');
  const sentMsg = await sendMessage(sock, sender, `⏳ Memulai proses upscale *${scale}x* dengan Pixnova...`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    const form = new FormData();
    form.append('image', imageBuffer, 'image.jpg');
    form.append('scale', scale);

    const { data: jobData } = await axios.post('https://szyrineapi.biz.id/api/img/pixnova/upscale', form, { 
      headers: form.getHeaders() 
    });

    if (!jobData.result?.statusUrl) {
      throw new Error(jobData.message || 'Gagal membuat job upscale.');
    }

    // Gunakan helper polling yang sudah ada
    const finalUrl = await pollPixnovaJob(jobData.result.statusUrl);
    
    await sendImage(sock, sender, finalUrl, `*🚀 Gambar berhasil di-upscale ${scale}x!*`, false, { quoted: message });
    await editMessage(sock, sender, '✅ Selesai!', messageKey);

  } catch (error) {
    console.error("[PIXNOVA UPSCALE] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal memproses gambar.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}