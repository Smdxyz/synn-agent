// modules/ai/gpt4c.js

import axios from 'axios';
import { sendMessage, react } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Mendapatkan jawaban singkat dan padat dari model GPT-4 Concise.';
export const usage = `${config.BOT_PREFIX}gpt4c <pertanyaan>`;
export const aliases = ['gpt4-c', 'concise'];

// --- FUNGSI UTAMA COMMAND ---
export default async function gpt4c(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Masukkan pertanyaan untuk jawaban singkat.\n\n*Contoh:*\n${config.BOT_PREFIX}gpt4c apa itu "cihuyyy"`, { quoted: message });
  }

  try {
    await react(sock, sender, message.key, '✍️');
    
    const apiUrl = `https://szyrineapi.biz.id/api/ai/gpt4-concise?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(apiUrl);

    if (response.data && response.data.result && response.data.result.answer) {
      const answer = response.data.result.answer;
      await sendMessage(sock, sender, answer, { quoted: message });
    } else {
      throw new Error('Respons API tidak valid.');
    }

  } catch (error) {
    console.error("[GPT4C COMMAND] Error:", error.response ? error.response.data : error.message);
    await sendMessage(sock, sender, "Maaf, terjadi kesalahan saat memproses jawaban singkat.", { quoted: message });
  }
}

export const cost = 15;
