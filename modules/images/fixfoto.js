// modules/images/remini.js (VERSI TANPA DEPENDENSI 'config.js')

import { sendMessage, react, downloadMedia, uploadImage, sendImage, editMessage } from '../../helper.js';
// import { config } from '../../config.js'; // <-- DIHAPUS, TIDAK DIPAKAI LAGI
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Memperbaiki kualitas foto (mirip Remini) menggunakan AI.';
export const usage = `!remini`; // <-- Diubah jadi teks statis
export const aliases = ['remini-enhance', 'fixfoto'];

// --- FUNGSI UTAMA COMMAND ---
export default async function remini(sock, message, args, query, sender) {
  const imageBuffer = await downloadMedia(message);
  
  if (!imageBuffer) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar untuk diproses dengan Remini.', { quoted: message });
  }

  await react(sock, sender, message.key, '🌟');
  const sentMsg = await sendMessage(sock, sender, `⏳ Memproses gambar dengan Remini...`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    const imageUrl = await uploadImage(imageBuffer);
    const apiUrl = `https://szyrineapi.biz.id/api/images/upscale/remini?url=${encodeURIComponent(imageUrl)}`;
    const { data } = await axios.get(apiUrl);

    if (data.result?.url) {
      // Caption disederhanakan, tidak lagi memanggil config.WATERMARK
      await sendImage(sock, sender, data.result.url, `*🌟 Gambar berhasil diproses!*`, false, { quoted: message });
      await editMessage(sock, sender, '✅ Selesai!', messageKey);
    } else {
      throw new Error(data.message || 'URL hasil tidak ditemukan.');
    }
  } catch (error) {
    console.error("[REMINI COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal memproses gambar.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}