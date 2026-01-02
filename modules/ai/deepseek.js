// modules/ai/deepseek.js

import axios from 'axios';
import { sendMessage, react } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Berinteraksi dengan DeepSeek AI dalam mode percakapan (mengingat konteks).';
export const usage = `${config.BOT_PREFIX}deepseek <pertanyaan> | reset`;
export const aliases = ['chat', 'ds'];

// --- PENYIMPANAN SESI PERCAKAPAN ---
const userSessions = new Map();

// --- FUNGSI UTAMA COMMAND ---
export default async function deepseek(sock, message, args, query, sender, extras) {
  // 1. Validasi Input
  if (!query) {
    const usageText = `Gunakan perintah ini untuk memulai percakapan dengan DeepSeek AI.\n\n*Contoh:*\n${config.BOT_PREFIX}deepseek ceritakan lelucon tentang programmer\n\nUntuk mereset percakapan, ketik:\n*${config.BOT_PREFIX}deepseek reset*`;
    return sendMessage(sock, sender, usageText, { quoted: message });
  }

  // 2. Fitur untuk mereset sesi percakapan
  if (query.toLowerCase() === 'reset') {
    if (userSessions.has(sender)) {
      userSessions.delete(sender);
      await react(sock, sender, message.key, '🗑️');
      return sendMessage(sock, sender, "Sesi percakapan Anda telah direset.", { quoted: message });
    } else {
      await react(sock, sender, message.key, '👍');
      return sendMessage(sock, sender, "Anda tidak memiliki sesi aktif untuk direset.", { quoted: message });
    }
  }

  try {
    // 3. Beri tahu pengguna bahwa proses sedang berjalan
    await react(sock, sender, message.key, '💬');

    // 4. Siapkan URL API dengan atau tanpa sessionId
    const userSessionId = userSessions.get(sender); // Ambil sessionId jika ada
    let apiUrl = `https://szyrineapi.biz.id/api/ai/deepseek?q=${encodeURIComponent(query)}&think=false`;

    if (userSessionId) {
      apiUrl += `&sessionId=${userSessionId}`;
      console.log(`[DEEPSEEK] Melanjutkan sesi untuk ${sender} dengan ID: ${userSessionId}`);
    } else {
      console.log(`[DEEPSEEK] Memulai sesi baru untuk ${sender}`);
    }
    
    // 5. Panggil API
    const response = await axios.get(apiUrl);

    // 6. Proses dan kirim hasil jika berhasil
    const result = response.data.result;
    if (result && result.success && result.result) {
      const answer = result.result;
      const newSessionId = result.sessionId;

      // Simpan/Update sessionId untuk percakapan selanjutnya
      userSessions.set(sender, newSessionId);
      
      await sendMessage(sock, sender, answer, { quoted: message });
    } else {
      throw new Error('Struktur respons API tidak valid atau tidak berisi jawaban.');
    }

  } catch (error) {
    // 7. Tangani jika terjadi error
    console.error("[DEEPSEEK COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMsg = "Maaf, terjadi kesalahan saat berkomunikasi dengan AI. Sesi Anda mungkin telah kedaluwarsa. Coba reset dengan `!deepseek reset` atau mulai percakapan baru.";
    await sendMessage(sock, sender, errorMsg, { quoted: message });
  }
}

export const cost = 15;
