// modules/ai/copilot.js

import axios from 'axios';
import { sendMessage, react } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Mengajukan pertanyaan ke Microsoft Copilot (model thinking).';
export const usage = `${config.BOT_PREFIX}copilot <pertanyaan>`;
export const aliases = ['copi'];

// --- FUNGSI UTAMA COMMAND ---
export default async function copilot(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Silakan ajukan pertanyaan.\n\n*Contoh:*\n${config.BOT_PREFIX}copilot resep membuat nasi goreng spesial`, { quoted: message });
  }

  try {
    await react(sock, sender, message.key, '✈️');

    const model = 'thinking'; // Sesuai contoh, bisa 'default' atau 'thinking'
    const apiUrl = `https://szyrineapi.biz.id/api/ai/copilot?q=${encodeURIComponent(query)}&model=${model}`;
    
    const response = await axios.get(apiUrl);

    if (response.data && response.data.result && response.data.result.result && response.data.result.result.text) {
      const answer = response.data.result.result.text;
      await sendMessage(sock, sender, answer, { quoted: message });
    } else {
      throw new Error('Respons API tidak valid.');
    }

  } catch (error) {
    console.error("[COPILOT COMMAND] Error:", error.response ? error.response.data : error.message);
    await sendMessage(sock, sender, "Maaf, terjadi kesalahan saat menghubungi Copilot.", { quoted: message });
  }
}