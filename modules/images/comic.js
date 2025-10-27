// modules/images/comic.js
import { sendMessage, react, downloadMedia, uploadImage, sendImage, editMessage, delay } from '../../helper.js';
import { config } from '../../config.js';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Mengubah gambar menjadi gaya komik/kartun.';
export const usage = `${config.BOT_PREFIX}comic`;
export const aliases = ['kartun', 'cartoon'];

// --- FUNGSI UTAMA COMMAND ---
export default async function comic(sock, message, args, query, sender) {
  const media = await downloadMedia(message);
  
  if (!media) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar untuk diubah menjadi gaya komik.', { quoted: message });
  }

  const { buffer, mimetype } = media;

  await react(sock, sender, message.key, '💥');
  const sentMsg = await sendMessage(sock, sender, `⏳ Menyiapkan tinta dan kertas...`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    // ---- Animasi Tunggu ----
    await delay(1000);
    await editMessage(sock, sender, `️ Membuat sketsa...`, messageKey);
    await delay(1500);
    await editMessage(sock, sender, `💥 Mengubah gambar menjadi komik...`, messageKey);
    // ------------------------

    const imageUrl = await uploadImage(buffer, mimetype);
    const apiUrl = `https://szyrineapi.biz.id/api/img/comic?url=${encodeURIComponent(imageUrl)}&apikey=${config.SZYRINE_API_KEY}`;
    const { data } = await axios.get(apiUrl);

    if (data.result?.hasil) {
      await sendImage(sock, sender, data.result.hasil, '*💥 Gambar versi komik!*', false, { quoted: message });
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