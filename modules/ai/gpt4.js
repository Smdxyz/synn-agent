// modules/ai/gpt4.js

import axios from 'axios';
import { sendMessage, react } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Mengajukan pertanyaan ke model AI GPT-4.';
export const usage = `${config.BOT_PREFIX}gpt4 <pertanyaan>`;
export const aliases = ['gpt-4'];

// --- FUNGSI UTAMA COMMAND ---
export default async function gpt4(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Silakan berikan pertanyaan.\n\n*Contoh:*\n${config.BOT_PREFIX}gpt4 jelaskan tentang wormhole`, { quoted: message });
  }

  try {
    await react(sock, sender, message.key, '💡');

    // API ini butuh sessionId acak, jadi kita buat setiap kali dipanggil
    const randomSessionId = Math.random().toString(36).substring(2);
    
    const apiUrl = `https://szyrineapi.biz.id/api/ai/gpt4?q=${encodeURIComponent(query)}&sessionId=${randomSessionId}`;
    
    const response = await axios.get(apiUrl);

    if (response.data && response.data.result && response.data.result.message) {
      const answer = response.data.result.message;
      await sendMessage(sock, sender, answer, { quoted: message });
    } else {
      throw new Error('Respons API tidak valid.');
    }

  } catch (error) {
    console.error("[GPT4 COMMAND] Error:", error.response ? error.response.data : error.message);
    await sendMessage(sock, sender, "Maaf, terjadi kesalahan saat menghubungi GPT-4.", { quoted: message });
  }
}

export const cost = 15;
