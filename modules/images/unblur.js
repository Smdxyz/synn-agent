// modules/images/unblur.js
import { sendMessage, react, downloadMedia, uploadImage, sendImage, editMessage, delay } from '../../helper.js';
import { config } from '../../config.js';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Memperjelas gambar yang buram (unblur).';
export const usage = `${config.BOT_PREFIX}unblur`;
export const aliases = ['deblur', 'jelasin'];

// --- FUNGSI UTAMA COMMAND ---
export default async function unblur(sock, message, args, query, sender) {
  const media = await downloadMedia(message);
  
  if (!media) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar yang buram untuk diperjelas.', { quoted: message });
  }

  const { buffer, mimetype } = media;

  await react(sock, sender, message.key, '💧');
  const sentMsg = await sendMessage(sock, sender, `⏳ Menganalisa tingkat blur...`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    // ---- Animasi Tunggu ----
    await delay(1000);
    await editMessage(sock, sender, `️ Mempertajam detail...`, messageKey);
    await delay(1500);
    await editMessage(sock, sender, `💧 Menghilangkan blur...`, messageKey);
    // ------------------------

    const imageUrl = await uploadImage(buffer, mimetype);
    const apiUrl = `https://szyrineapi.biz.id/api/img/upscale/unblur?url=${encodeURIComponent(imageUrl)}`;
    const { data } = await axios.get(apiUrl);

    if (data.result?.result_url) {
      await sendImage(sock, sender, data.result.result_url, `*💧 Gambar berhasil diperjelas!*`, false, { quoted: message });
      await editMessage(sock, sender, '✅ Selesai!', messageKey);
    } else {
      throw new Error(data.message || 'URL hasil tidak ditemukan.');
    }
  } catch (error) {
    console.error("[UNBLUR COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal memproses gambar.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}