// modules/downloaders/ytmp4.js

import axios from 'axios';
import { sendMessage, sendVideo, react, editMessage, delay } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh video dari YouTube sebagai file MP4.';
export const usage = `${config.BOT_PREFIX}ytmp4 <url_video_youtube>`;
export const aliases = ['ytv', 'ytvideo'];

// --- FUNGSI UTAMA COMMAND ---
export default async function ytmp4(sock, message, args, query, sender) {
  if (!query || (!query.includes('youtube.com') && !query.includes('youtu.be'))) {
    return sendMessage(sock, sender, `Masukkan URL video YouTube yang valid.\n\n*Contoh:*\n${usage}`, { quoted: message });
  }

  await react(sock, sender, message.key, '📥');
  const waitingMsg = await sendMessage(sock, sender, '⏳ Memulai proses download video YouTube...', { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    // ---- LANGKAH 1: MEMBUAT JOB DOWNLOAD ----
    const initialApiUrl = `https://szyrineapi.biz.id/api/youtube/download/mp4?url=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
    const { data: jobData } = await axios.get(initialApiUrl);

    if (!jobData.result?.statusCheckUrl) {
      throw new Error(jobData.message || 'Gagal memulai job download. URL mungkin tidak valid.');
    }

    const { statusCheckUrl } = jobData.result;
    await editMessage(sock, sender, '✅ Job diterima! Memproses video...', messageKey);

    // ---- LANGKAH 2: POLLING STATUS JOB ----
    let finalResult = null;
    const maxAttempts = 30; // Timeout ~2.5 menit (30 x 5 detik)

    for (let i = 0; i < maxAttempts; i++) {
      await delay(5000); // Tunggu 5 detik sebelum cek status lagi

      const { data: statusData } = await axios.get(statusCheckUrl);
      const jobResult = statusData.result;

      if (jobResult?.status === 'completed') {
        finalResult = jobResult.result;
        break; // Hentikan loop jika sudah selesai
      } else if (jobResult?.status === 'failed' || jobResult?.status === 'error') {
        throw new Error(jobResult.message || 'Proses download gagal di server.');
      } else {
        // Update status ke pengguna
        await editMessage(sock, sender, `⏳ Memproses video... (${i + 1}/${maxAttempts})`, messageKey);
      }
    }

    // ---- LANGKAH 3: MENGIRIM HASIL ----
    if (finalResult && finalResult.link) {
      const { title, link: videoUrl } = finalResult;
      const caption = `*${title}*\n\n*${config.WATERMARK}*`;
      
      await sendVideo(sock, sender, videoUrl, caption, { quoted: message });
      await editMessage(sock, sender, '✅ Video berhasil diunduh!', messageKey);
    } else {
      throw new Error('Waktu pemrosesan habis (timeout). Coba lagi nanti.');
    }

  } catch (error) {
    console.error("[YTMP4 DOWNLOADER] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat mengunduh video.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}