// modules/images/unblur.js

import { sendMessage, react, downloadMedia, uploadImage, sendImage, editMessage } from '../../helper.js';
import { config } from '../../config.js';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Memperjelas gambar yang buram (unblur).';
export const usage = `${config.BOT_PREFIX}unblur`;
export const aliases = ['deblur', 'jelasin'];

// --- FUNGSI UTAMA COMMAND ---
export default async function unblur(sock, message, args, query, sender) {
  const imageBuffer = await downloadMedia(message);
  
  if (!imageBuffer) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar yang buram untuk diperjelas.', { quoted: message });
  }

  await react(sock, sender, message.key, '💧');
  const sentMsg = await sendMessage(sock, sender, `⏳ Menghilangkan blur pada gambar...`, { quoted: message });
  const messageKey = sentMsg.key;

  try {
    const imageUrl = await uploadImage(imageBuffer);
    const apiUrl = `https://szyrineapi.biz.id/api/images/upscale/unblur?url=${encodeURIComponent(imageUrl)}`;
    const { data } = await axios.get(apiUrl);

    if (data.result?.result_url) {
      await sendImage(sock, sender, data.result.result_url, `*💧 Gambar berhasil diperjelas!*`, { quoted: message });
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