// modules/downloaders/ytmp4.js (FIXED WITH USER-AGENT)

import axios from 'axios';
import { sendMessage, sendVideo, react, editMessage, delay } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh video dari YouTube sebagai file MP4.';
export const usage = `${config.BOT_PREFIX}ytmp4 <url_video_youtube>`;
export const aliases = ['ytv', 'ytvideo'];

// [PERBAIKAN] Menambahkan User-Agent untuk menghindari error 403 Forbidden
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
];
const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// --- FUNGSI UTAMA COMMAND ---
export default async function ytmp4(sock, message, args, query, sender) {
  if (!query || (!query.includes('youtube.com') && !query.includes('youtu.be'))) {
    return sendMessage(sock, sender, `Masukkan URL video YouTube yang valid.\n\n*Contoh:*\n${usage}`, { quoted: message });
  }

  await react(sock, sender, message.key, '📥');
  const waitingMsg = await sendMessage(sock, sender, '⏳ Memulai proses download video YouTube...', { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const axiosConfig = { headers: { 'User-Agent': getRandomUserAgent() } };

    // ---- LANGKAH 1: MEMBUAT JOB DOWNLOAD ----
    const initialApiUrl = `https://szyrineapi.biz.id/api/youtube/download/mp4?url=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
    const { data: jobData } = await axios.get(initialApiUrl, axiosConfig); // <-- Ditambahkan User-Agent

    if (!jobData.result?.statusCheckUrl) {
      throw new Error(jobData.message || 'Gagal memulai job download. URL mungkin tidak valid.');
    }

    const { statusCheckUrl } = jobData.result;
    await editMessage(sock, sender, '✅ Job diterima! Memproses video...', messageKey);

    // ---- LANGKAH 2: POLLING STATUS JOB ----
    let finalResult = null;
    const maxAttempts = 30;

    for (let i = 0; i < maxAttempts; i++) {
      await delay(5000);

      const { data: statusData } = await axios.get(statusCheckUrl, axiosConfig); // <-- Ditambahkan User-Agent
      const jobResult = statusData.result;

      if (jobResult?.status === 'completed') {
        finalResult = jobResult.result;
        break;
      } else if (jobResult?.status === 'failed' || jobResult?.status === 'error') {
        throw new Error(jobResult.message || 'Proses download gagal di server.');
      } else {
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