// modules/ai/perplexity.js

import axios from 'axios';
import { sendMessage, react } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Mengajukan pertanyaan ke Perplexity AI untuk mendapatkan jawaban komprehensif.';
export const usage = `${config.BOT_PREFIX}perplexity <pertanyaan>`;
export const aliases = ['ask', 'ai', 'tanya', 'pplx'];

// --- FUNGSI UTAMA COMMAND ---
export default async function perplexity(sock, message, args, query, sender, extras) {
  // 1. Validasi Input
  if (!query) {
    const usageText = `Silakan ajukan pertanyaan setelah perintah.\n\n*Contoh:*\n${usage}`;
    return sendMessage(sock, sender, usageText, { quoted: message });
  }

  try {
    // 2. Beri tahu pengguna bahwa proses sedang berjalan
    await react(sock, sender, message.key, '🧠'); // React dengan emoji otak

    // 3. Siapkan dan panggil API
    const apiUrl = `https://szyrineapi.biz.id/api/ai/perplexity?prompt=${encodeURIComponent(query)}`;
    
    const response = await axios.get(apiUrl);

    // 4. Proses dan kirim hasil jika berhasil
    if (response.data && response.data.result && response.data.result.message) {
      const answer = response.data.result.message;
      
      // Menambahkan prefix agar terlihat lebih rapi
      const formattedReply = `🧠 *Perplexity AI menjawab:*\n\n${answer}`;
      
      await sendMessage(sock, sender, formattedReply, { quoted: message });
    } else {
      // Jika struktur response tidak sesuai dugaan
      throw new Error('Struktur respons API tidak valid atau tidak berisi jawaban.');
    }

  } catch (error) {
    // 5. Tangani jika terjadi error
    console.error("[PERPLEXITY COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMsg = "Maaf, terjadi kesalahan saat memproses pertanyaan Anda. Mungkin AI sedang sibuk atau ada masalah dengan server.";
    await sendMessage(sock, sender, errorMsg, { quoted: message });
  }
}