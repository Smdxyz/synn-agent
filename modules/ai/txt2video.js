// modules/ai/txt2video.js

import axios from 'axios';
import { sendMessage, sendVideo, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Membuat video pendek dari deskripsi teks menggunakan AI.';
export const usage = `${config.BOT_PREFIX}txt2video <deskripsi video>`;
export const aliases = ['t2v', 'aitovideo'];

// --- FUNGSI UTAMA COMMAND ---
export default async function txt2video(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Berikan deskripsi video yang ingin dibuat.\n\n*Contoh:*\n${usage}`, { quoted: message });
  }

  await react(sock, sender, message.key, '🎥');
  const waitingMsg = await sendMessage(sock, sender, `🎬 Sedang membuat video dari prompt:\n\n*${query}*\n\nMohon tunggu, proses ini bisa memakan waktu cukup lama...`, { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const apiUrl = `https://szyrineapi.biz.id/api/ai/txt2video?prompt=${encodeURIComponent(query)}`;
    
    const response = await axios.get(apiUrl);

    if (response.data?.result?.result?.url) {
      const videoUrl = response.data.result.result.url;
      
      await sendVideo(sock, sender, videoUrl, `*Prompt:* ${query}\n*${config.WATERMARK}*`, { quoted: message });
      await editMessage(sock, sender, '✅ Video berhasil dibuat!', messageKey);
    } else {
      // Ambil pesan error dari API jika ada, jika tidak, gunakan pesan default
      throw new Error(response.data.message || 'Respons API tidak valid atau tidak berisi URL video.');
    }

  } catch (error) {
    console.error("[TXT2VIDEO COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || "Gagal membuat video. API mungkin sedang sibuk atau prompt Anda terlalu rumit.";
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}