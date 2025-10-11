// modules/utilities/upload.js

import { sendMessage, react, downloadMedia, editMessage } from '../../helper.js';
import { config } from '../../config.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Utilities';
export const description = 'Mengunggah gambar/video ke host dan mendapatkan direct link.';
export const usage = `${config.BOT_PREFIX}upload [waktu_hapus]`;
export const aliases = ['up', 'tourl'];

// --- FUNGSI UTAMA COMMAND ---
export default async function upload(sock, message, args, query, sender) {
  // downloadMedia bisa menangani gambar, video, dan stiker
  const fileBuffer = await downloadMedia(message); 
  
  if (!fileBuffer) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar/video untuk diunggah.', { quoted: message });
  }

  // Waktu hapus opsional, contoh: 10m, 1h, 1d. Default 1 jam.
  const expiry = args[0] || '1h';

  await react(sock, sender, message.key, '📤');
  const waitingMsg = await sendMessage(sock, sender, `📤 Mengunggah file...`, { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const form = new FormData();
    form.append('file', fileBuffer, 'file'); // Nama file generik
    form.append('expiry', expiry);

    const { data } = await axios.post(`https://szyrineapi.biz.id/api/fileHost/upload?apikey=${config.SZYRINE_API_KEY}`, form, { 
      headers: form.getHeaders() 
    });

    if (data.result?.success) {
      const res = data.result;
      const replyText = `*✅ Upload Berhasil!*\n\n🔗 *Link:* ${res.directLink}\n🕒 *Hapus Dalam:* ${res.expiresIn}`;
      // Edit pesan "mengunggah..." menjadi hasil akhirnya
      await editMessage(sock, sender, replyText, messageKey);
    } else {
      throw new Error(data.result?.message || 'Gagal mengunggah file.');
    }
  } catch (error) {
    console.error("[UPLOAD] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan tidak diketahui.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}