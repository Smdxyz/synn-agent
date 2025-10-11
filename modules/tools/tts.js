// modules/tools/tts.js

import axios from 'axios';
import { sendMessage, sendAudio, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Tools';
export const description = 'Mengubah teks menjadi suara (Text-to-Speech) menggunakan ElevenLabs.';
export const usage = `${config.BOT_PREFIX}tts <teks>`;
export const aliases = ['speak', 'suara'];

// Batasan karakter
const MAX_CHARS = 50;

// --- FUNGSI UTAMA COMMAND ---
export default async function tts(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Masukkan teks yang ingin diubah menjadi suara (maksimal ${MAX_CHARS} karakter).\n\n*Contoh:*\n${usage} Halo, apa kabar?`, { quoted: message });
  }

  // Validasi batasan karakter
  if (query.length > MAX_CHARS) {
    return sendMessage(sock, sender, `❌ Teks terlalu panjang! Maksimal adalah ${MAX_CHARS} karakter. Anda memasukkan ${query.length} karakter.`, { quoted: message });
  }

  await react(sock, sender, message.key, '🗣️');
  const waitingMsg = await sendMessage(sock, sender, '⏳ Memproses teks menjadi suara...', { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const apiUrl = `https://szyrineapi.biz.id/api/tools/tts/elevenlabs?apikey=${config.SZYRINE_API_KEY}`;
    
    // Data yang dikirim dalam body request
    const postData = {
      text: query,
      // Opsi lain bisa ditambahkan di sini jika diperlukan, misal: voiceId
    };

    const { data } = await axios.post(apiUrl, postData, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!data.result || !data.result.url) {
      throw new Error(data.message || 'Gagal mengubah teks menjadi suara. URL tidak ditemukan.');
    }

    const audioUrl = data.result.url;

    // Mengirim hasil sebagai voice note (ptt: true)
    await sendAudio(sock, sender, audioUrl, { ptt: false, quoted: message });
    await editMessage(sock, sender, '✅ Selesai!', messageKey);

  } catch (error) {
    console.error("[TTS] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat memproses permintaan.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}