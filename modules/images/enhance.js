// modules/images/enhance.js (FIXED)

import { sendMessage, react, downloadMedia, sendImage, pollPixnovaJob, editMessage } from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';
import { config } from '../../config.js'; // <-- BARIS INI YANG MEMPERBAIKI ERROR

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Meningkatkan detail dan kualitas visual gambar (AI Enhance).';
export const usage = `${config.BOT_PREFIX}enhance [creativity_level]`;
export const aliases = ['hd-enhance'];

// --- FUNGSI UTAMA COMMAND ---
export default async function enhance(sock, message, args, query, sender) {
  const imageBuffer = await downloadMedia(message);
  
  if (!imageBuffer) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar untuk di-enhance (peningkatan visual).', { quoted: message });
  }

  // Ambil level kreativitas dari argumen (0.0 - 1.0), default '0.2'
  const creative = args[0] && !isNaN(parseFloat(args[0])) ? parseFloat(args[0]) : '0.2';

  await react(sock, sender, message.key, '🎨');
  const sentMsg = await sendMessage(sock, sender, `⏳ Memulai proses enhancement gambar... Ini mungkin butuh waktu.`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    const form = new FormData();
    form.append('image', imageBuffer, 'image.jpg');
    form.append('creative', creative);

    const { data: jobData } = await axios.post('https://szyrineapi.biz.id/api/images/pixnova/enhance', form, { 
      headers: form.getHeaders() 
    });
    
    if (!jobData.result?.statusUrl) {
      throw new Error(jobData.message || 'Gagal membuat job enhancement.');
    }

    const finalUrl = await pollPixnovaJob(jobData.result.statusUrl);
    
    await sendImage(sock, sender, finalUrl, `*🎨 Gambar berhasil di-enhance!*`, false, { quoted: message });
    await editMessage(sock, sender, '✅ Selesai!', messageKey);

  } catch (error) {
    console.error("[ENHANCE COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal memproses gambar.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}