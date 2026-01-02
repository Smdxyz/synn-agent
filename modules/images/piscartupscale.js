// modules/images/piscartupscale.js

import { sendMessage, react, downloadMedia, sendImage, editMessage, delay } from '../../helper.js';
import FormData from 'form-data';
import axios from 'axios';
import { config } from '../../config.js'; // Impor config untuk prefix

// --- METADATA COMMAND ---
export const category = 'Images';
export const description = 'Meningkatkan resolusi gambar (2x, 4x, 8x) menggunakan model PicsArt.';
export const usage = `${config.BOT_PREFIX}piscartupscale [2|4|8]`;
export const aliases = ['hd-picsart', 'picsart'];

// --- FUNGSI UTAMA COMMAND ---
export default async function piscartupscale(sock, message, args, query, sender) {
  const media = await downloadMedia(message);
  
  if (!media) {
    return sendMessage(sock, sender, `Kirim atau balas sebuah gambar untuk di-upscale.\n\n*Contoh:*\nBalas gambar dengan \`!picsart 4\``, { quoted: message });
  }

  const { buffer, mimetype } = media;
  const scale = args[0] && ['2', '4', '8'].includes(args[0]) ? args[0] : '4';

  await react(sock, sender, message.key, '✨');
  const waitingMsg = await sendMessage(sock, sender, `⏳ Mengkalibrasi ulang piksel...`, { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    await delay(1000);
    await editMessage(sock, sender, `✨ Memproses upscale gambar dengan skala *${scale}x*...`, messageKey);

    const form = new FormData();
    form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
    form.append('scale', scale);

    const { data } = await axios.post('https://szyrineapi.biz.id/api/img/upscale/picsart', form, { 
      headers: form.getHeaders() 
    });

    if (data.result?.result_url) {
      await sendImage(sock, sender, data.result.result_url, `*✨ Gambar berhasil di-upscale ${scale}x!*`, false, { quoted: message });
      await editMessage(sock, sender, '✅ Selesai!', messageKey);
    } else {
      throw new Error(data.message || 'URL hasil tidak ditemukan.');
    }
  } catch (error) {
    console.error("[PICSART UPSCALE] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal memproses gambar.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}

export const cost = 10;
