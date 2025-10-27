// modules/images/removebg.js
import { sendMessage, react, downloadMedia, uploadImage, sendImage, editMessage, delay } from '../../helper.js';
import axios from 'axios';
import { config } from '../../config.js'; // Impor config untuk prefix

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Menghapus background dari sebuah gambar.';
export const usage = `${config.BOT_PREFIX}removebg`;
export const aliases = ['nobg', 'rmbg'];

// --- FUNGSI UTAMA COMMAND ---
export default async function removebg(sock, message, args, query, sender) {
  const media = await downloadMedia(message);
  
  if (!media) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar untuk dihapus background-nya.', { quoted: message });
  }

  const { buffer, mimetype } = media;

  await react(sock, sender, message.key, '✂️');
  const sentMsg = await sendMessage(sock, sender, `⏳ Menyiapkan kanvas...`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    // ---- Animasi Tunggu ----
    await delay(1000);
    await editMessage(sock, sender, `️ Mencari objek utama...`, messageKey);
    await delay(1500);
    await editMessage(sock, sender, `✂️ Memotong background...`, messageKey);
    // ------------------------

    const imageUrl = await uploadImage(buffer, mimetype);
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