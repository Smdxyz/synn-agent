// /modules/tools/tts.js (NEW - Microsoft Edge TTS Engine)

import axios from 'axios';
import { sendMessage, sendAudio, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Tools';
export const description = 'Mengubah teks menjadi suara (Text-to-Speech) dengan berbagai pilihan suara.';
export const usage = `${config.BOT_PREFIX}tts <teks>`;
export const aliases = ['speak', 'suara', 'say'];

// Batasan karakter
const MAX_CHARS = 250;

// --- FUNGSI UTAMA COMMAND (INTERACTIVE) ---
export default async function tts(sock, message, args, query, sender, extras) {
  const textToSpeak = query;

  if (!textToSpeak) {
    return sendMessage(sock, sender, `Masukkan teks yang ingin diubah menjadi suara (maksimal ${MAX_CHARS} karakter).\n\n*Contoh:*\n${usage} Halo, selamat pagi semua.`, { quoted: message });
  }

  if (textToSpeak.length > MAX_CHARS) {
    return sendMessage(sock, sender, `❌ Teks terlalu panjang! Maksimal adalah ${MAX_CHARS} karakter. Anda memasukkan ${textToSpeak.length} karakter.`, { quoted: message });
  }

  await react(sock, sender, message.key, '🗣️');
  const waitingMsg = await sendMessage(sock, sender, '⏳ Mengambil daftar suara yang tersedia...', { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    // 1. Ambil daftar suara dari API
    const voicesApiUrl = 'https://szyrineapi.biz.id/api/tools/tts/edge/voices';
    const { data: voicesResponse } = await axios.get(voicesApiUrl);

    if (!voicesResponse.result || !voicesResponse.result.success || !voicesResponse.result.voices) {
      throw new Error('Gagal mengambil daftar suara dari API.');
    }
    const voices = voicesResponse.result.voices;

    // 2. Format daftar suara untuk ditampilkan ke pengguna
    let voiceListText = 'Silakan pilih suara yang Anda inginkan dengan membalas pesan ini menggunakan nomornya:\n\n';
    voices.forEach((voice, index) => {
      voiceListText += `*${index + 1}.* ${voice.name}\n`;
    });
    voiceListText += '\nKetik "batal" untuk membatalkan.';

    await editMessage(sock, sender, voiceListText, messageKey);

    // 3. Gunakan 'waitState' untuk menunggu balasan pengguna
    extras.set(sender, 'tts', {
      timeout: 60000, // Waktu tunggu 60 detik
      context: { 
        textToSpeak, // Simpan teks asli
        voices,        // Simpan daftar suara
        originalMessage: message, // Simpan pesan asli untuk di-quote
        progressMsgKey: messageKey // Simpan key pesan progress
      },
      handler: handleVoiceSelection, // Tentukan fungsi handler untuk balasan
    });

  } catch (error) {
    console.error("[TTS_SETUP] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat mengambil data suara.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}


/**
 * Handler untuk memproses balasan pilihan suara dari pengguna.
 * Fungsi ini dipanggil oleh message.handler.js saat state 'tts' aktif.
 */
async function handleVoiceSelection(sock, message, text, context) {
  const sender = message.key.remoteJid;
  const choice = text.trim();
  const { textToSpeak, voices, originalMessage, progressMsgKey } = context;

  // Cek jika pengguna ingin membatalkan
  if (choice.toLowerCase() === 'batal') {
    await editMessage(sock, sender, '✅ Pilihan dibatalkan.', progressMsgKey);
    return true; // Hentikan state, balasan valid
  }

  const choiceIndex = parseInt(choice, 10);

  // Validasi input pengguna
  if (isNaN(choiceIndex) || choiceIndex < 1 || choiceIndex > voices.length) {
    await sendMessage(sock, sender, '⚠️ Pilihan tidak valid. Harap balas dengan nomor yang benar dari daftar di atas.', { quoted: message });
    return false; // Jaga state tetap aktif, balasan tidak valid
  }

  const selectedVoice = voices[choiceIndex - 1];
  await editMessage(sock, sender, `✅ Suara *${selectedVoice.name}* dipilih. Memproses teks menjadi suara...`, progressMsgKey);

  try {
    // Panggil API untuk men-generate audio
    const ttsApiUrl = `https://szyrineapi.biz.id/api/tools/tts/edge?apikey=${config.SZYRINE_API_KEY}`;
    const postData = {
      text: textToSpeak,
      voice: selectedVoice.id,
      rate: "0%", // Default rate
      pitch: "0Hz" // Default pitch
    };

    const response = await axios.post(ttsApiUrl, postData, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'arraybuffer' // PENTING: Minta respons sebagai buffer
    });

    // Kirim buffer audio sebagai voice note (ptt: true)
    await sendAudio(sock, sender, response.data, { ptt: true, quoted: originalMessage });
    await editMessage(sock, sender, '✅ Selesai!', progressMsgKey);

    return true; // Hentikan state, proses selesai

  } catch (error) {
    console.error("[TTS_GENERATE] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat memproses permintaan.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, progressMsgKey);
    return true; // Hentikan state, meskipun gagal
  }
}

export const cost = 2;
