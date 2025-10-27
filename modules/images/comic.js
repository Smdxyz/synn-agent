// modules/images/comic.js

import { sendMessage, react, downloadMedia, uploadImage, sendImage, editMessage } from '../../helper.js';
import { config } from '../../config.js';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Mengubah gambar menjadi gaya komik/kartun.';
export const usage = `${config.BOT_PREFIX}comic`;
export const aliases = ['kartun', 'cartoon'];

// --- FUNGSI UTAMA COMMAND ---
export default async function comic(sock, message, args, query, sender) {
  const imageBuffer = await downloadMedia(message);
  
  if (!imageBuffer) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar untuk diubah menjadi gaya komik.', { quoted: message });
  }

  await react(sock, sender, message.key, '💥');
  const sentMsg = await sendMessage(sock, sender, `⏳ Mengubah gambar menjadi komik...`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    const imageUrl = await uploadImage(imageBuffer);
    const apiUrl = `https://szyrineapi.biz.id/api/img/comic?url=${encodeURIComponent(imageUrl)}&apikey=${config.SZYRINE_API_KEY}`;
    const { data } = await axios.get(apiUrl);

    if (data.result?.hasil) {
      await sendImage(sock, sender, data.result.hasil, '*💥 Gambar versi komik!*', { quoted: message });
      await editMessage(sock, sender, '✅ Selesai!', messageKey);
    } else {
      throw new Error(data.message || 'URL hasil tidak ditemukan.');
    }
  } catch (error) {
    console.error("[COMIC COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal membuat efek komik.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}