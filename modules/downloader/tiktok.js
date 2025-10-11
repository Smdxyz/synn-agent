// modules/downloaders/tiktok.js

import axios from 'axios';
import { sendMessage, sendVideo, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh video TikTok tanpa watermark.';
export const usage = `${config.BOT_PREFIX}tiktok <url_video_tiktok>`;
export const aliases = ['tt', 'tiktokdl'];

// --- FUNGSI UTAMA COMMAND ---
export default async function tiktok(sock, message, args, query, sender) {
  if (!query || !query.includes('tiktok.com')) {
    return sendMessage(sock, sender, `Masukkan URL video TikTok yang valid.\n\n*Contoh:*\n${usage}`, { quoted: message });
  }

  await react(sock, sender, message.key, '📥');
  const waitingMsg = await sendMessage(sock, sender, '⏳ Sedang mengunduh video TikTok...', { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const apiUrl = `https://szyrineapi.biz.id/api/downloaders/tiktok-vid?url=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
    
    const { data } = await axios.get(apiUrl);

    if (!data.result || !data.result.status) {
      throw new Error(data.message || 'Gagal mendapatkan data dari API. URL mungkin tidak valid.');
    }

    const result = data.result;

    // Prioritaskan link no-watermark HD, jika tidak ada, gunakan no-watermark biasa
    const videoData = result.data;
    const noWatermarkHD = videoData.find(v => v.type === 'nowatermark_hd');
    const noWatermark = videoData.find(v => v.type === 'nowatermark');
    
    const videoUrl = noWatermarkHD?.url || noWatermark?.url;

    if (!videoUrl) {
      throw new Error('Tidak ditemukan video tanpa watermark dalam respons API.');
    }

    // Membuat caption yang kaya informasi sesuai permintaan
    const caption = `
*${result.title}*

❤️ *Likes:* ${result.stats.likes}
💬 *Komen:* ${result.stats.comment}
🔗 *Dibagikan:* ${result.stats.share}
👀 *Dilihat:* ${result.stats.views}

👤 *Author:* ${result.author.nickname}
🎵 *Sound:* ${result.music_info.title}

*${config.WATERMARK}*
    `.trim();

    await sendVideo(sock, sender, videoUrl, caption, { quoted: message });
    await editMessage(sock, sender, '✅ Video berhasil diunduh!', messageKey);

  } catch (error) {
    console.error("[TIKTOK DOWNLOADER] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat mengunduh video.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}