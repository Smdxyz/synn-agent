// modules/downloaders/snackvideo.js (ENDPOINT BARU)

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
  if (!query || (!query.includes('snackvideo.com') && !query.includes('sck.io'))) {
    return sendMessage(sock, sender, `Masukkan URL video Snack Video yang valid.\n\n*Contoh:*\n${usage}`, { quoted: message });
  }

  await react(sock, sender, message.key, '📥');
  const waitingMsg = await sendMessage(sock, sender, '⏳ Sedang mengunduh video Snack Video...', { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    // <-- ENDPOINT DIPERBARUI
    const apiUrl = `https://szyrineapi.biz.id/api/dl/snackvideo?url=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
    
    const { data } = await axios.get(apiUrl);

    if (!data.result?.success || !data.result.media || data.result.media.length === 0) {
      throw new Error(data.result?.message || 'Gagal mendapatkan data dari API.');
    }

    const videoUrl = data.result.media[0].url;
    const caption = data.result.caption || `Diunduh dengan ${config.botName}`;

    await sendVideo(sock, sender, videoUrl, caption, { quoted: message });
    await editMessage(sock, sender, '✅ Video berhasil diunduh!', messageKey);

  } catch (error) {
    console.error("[SNACKVIDEO DOWNLOADER] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat mengunduh video.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}

export const cost = 5;
