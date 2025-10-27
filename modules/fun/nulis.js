// modules/fun/nulis.js

import { sendMessage, react, sendImage, editMessage, delay } from '../../helper.js';
import { config } from '../../config.js';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Fun';
export const description = 'Menulis teks di atas gambar buku.';
export const usage = `${config.BOT_PREFIX}nulis <teks kamu>`;
export const aliases = ['tulis'];

// --- FUNGSI UTAMA COMMAND ---
export default async function nulis(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Masukkan teks yang ingin ditulis di buku.\n\n*Contoh:*\n${usage}`, { quoted: message });
  }

  await react(sock, sender, message.key, '📝');
  const waitingMsg = await sendMessage(sock, sender, `⏳ Menyiapkan pulpen dan buku...`, { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    // --- Animasi Tunggu ---
    await delay(1000);
    await editMessage(sock, sender, `✍️ Mulai menulis: *"${query.slice(0, 20)}..."*`, messageKey);
    // -----------------------

    const apiUrl = `https://szyrineapi.biz.id/api/img/nulis?text=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

    await sendImage(sock, sender, response.data, 'Ini hasilnya...', false, { quoted: message });
    await editMessage(sock, sender, '✅ Selesai!', messageKey);
  } catch (error) {
    console.error("[NULIS] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal menulis di buku.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}