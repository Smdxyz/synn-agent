// modules/images/removebg.js

import { sendMessage, react, downloadMedia, uploadImage, sendImage, editMessage } from '../../helper.js';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Menghapus background dari sebuah gambar.';
export const usage = `${process.env.BOT_PREFIX || '!'}removebg`;
export const aliases = ['nobg', 'rmbg'];

// --- FUNGSI UTAMA COMMAND ---
export default async function removebg(sock, message, args, query, sender) {
  const imageBuffer = await downloadMedia(message);
  
  if (!imageBuffer) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar untuk dihapus background-nya.', { quoted: message });
  }

  await react(sock, sender, message.key, '✂️');
  const sentMsg = await sendMessage(sock, sender, `⏳ Menghapus background gambar...`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    const imageUrl = await uploadImage(imageBuffer);
    const apiUrl = `https://szyrineapi.biz.id/api/img/removebg/pixelcut?url=${encodeURIComponent(imageUrl)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

    await sendImage(sock, sender, response.data, '*✂️ Background berhasil dihapus!*', false, { quoted: message });
    await editMessage(sock, sender, '✅ Selesai!', messageKey);
  } catch (error) {
    console.error("[REMOVEBG COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal menghapus background.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}