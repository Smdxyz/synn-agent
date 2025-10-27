// modules/images/describe.js

import { sendMessage, react, downloadMedia } from '../../helper.js'; // <-- Ubah import
import { config } from '../../config.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Mendeskripsikan konten sebuah gambar menggunakan AI.';
export const usage = `${config.BOT_PREFIX}describe`;
export const aliases = ['whatisthis'];

// --- FUNGSI UTAMA COMMAND ---
export default async function describe(sock, message, args, query, sender) {
  // Gunakan downloadMedia yang lebih cerdas
  const imageBuffer = await downloadMedia(message);

  if (!imageBuffer) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar dengan perintah `!describe` untuk dideskripsikan oleh AI.', { quoted: message });
  }

  try {
    await react(sock, sender, message.key, '👁️');
    
    // API Szyrine tidak memerlukan API Key untuk endpoint ini
    const form = new FormData();
    form.append('image', imageBuffer, 'image.jpg');

    const { data } = await axios.post('https://szyrineapi.biz.id/api/img/describe/zoner', form, { 
      headers: form.getHeaders() 
    });
    
    if (data.result) {
      await sendMessage(sock, sender, `*👁️ Deskripsi Gambar:*\n\n${data.result}`, { quoted: message });
    } else {
      throw new Error(data.message || 'Hasil deskripsi tidak ditemukan.');
    }
  } catch (error) {
    console.error("[DESCRIBE COMMAND] Error:", error.response ? error.response.data : error.message);
    sendMessage(sock, sender, 'Maaf, gagal mendeskripsikan gambar.', { quoted: message });
  }
}