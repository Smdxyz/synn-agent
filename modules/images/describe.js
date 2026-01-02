// modules/images/describe.js

import { sendMessage, react, downloadMedia } from '../../helper.js';
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
  const media = await downloadMedia(message);

  if (!media) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar dengan perintah `!describe` untuk dideskripsikan oleh AI.', { quoted: message });
  }

  const { buffer, mimetype } = media;

  try {
    await react(sock, sender, message.key, '👁️');
    
    const form = new FormData();
    // PERBAIKAN DI SINI
    form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });

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

export const cost = 10;
