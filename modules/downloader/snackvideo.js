// modules/downloaders/snackvideo.js

import axios from 'axios';
import { sendMessage, sendVideo, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh video dari Snack Video.';
export const usage = `${config.BOT_PREFIX}snack <url_video>`;
export const aliases = ['snackdl', 'svdl'];

// --- FUNGSI UTAMA COMMAND ---
export default async function snack(sock, message, args, query, sender) {
  // Validasi URL, cek domain utama dan shortlink-nya (sck.io)
  if (!query || (!query.includes('snackvideo.com') && !query.includes('sck.io'))) {
    return sendMessage(sock, sender, `Masukkan URL video Snack Video yang valid.\n\n*Contoh:*\n${usage}`, { quoted: message });
  }

  await react(sock, sender, message.key, '📥');
  const waitingMsg = await sendMessage(sock, sender, '⏳ Sedang mengunduh video Snack Video...', { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const apiUrl = `https://szyrineapi.biz.id/api/downloaders/snackvideo?url=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
    
    const { data } = await axios.get(apiUrl);

    if (!data.result || !data.result.success) {
      throw new Error(data.message || 'Gagal mendapatkan data dari API. URL mungkin tidak valid.');
    }

    const videoUrl = data.result.url;
    
    // Karena API tidak memberikan judul, kita buat caption sederhana
    const caption = `*${config.WATERMARK}*`;

    await sendVideo(sock, sender, videoUrl, caption, { quoted: message });
    await editMessage(sock, sender, '✅ Video berhasil diunduh!', messageKey);

  } catch (error) {
    console.error("[SNACKVIDEO DOWNLOADER] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat mengunduh video.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}