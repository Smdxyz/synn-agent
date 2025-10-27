// modules/ai/copilot.js

import axios from 'axios';
import { sendMessage, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Mengajukan pertanyaan ke Microsoft Copilot.';
export const usage = `${config.BOT_PREFIX}copilot <pertanyaan> [--model MODEL]`;
export const aliases = ['copi'];

// --- FUNGSI UTAMA COMMAND ---
export default async function copilot(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Silakan ajukan pertanyaan.\n\n*Contoh:*\n${config.BOT_PREFIX}copilot resep nasi goreng\n\n*Ganti Model:*\n${config.BOT_PREFIX}copilot apa itu AI --model gpt-5`, { quoted: message });
  }

  const availableModels = ['default', 'think-deeper', 'gpt-5'];
  let model = 'think-deeper'; // Model default baru
  let userQuery = query;

  // Cek jika pengguna menyertakan flag --model
  if (query.includes('--model')) {
    const parts = query.split('--model');
    userQuery = parts[0].trim();
    const modelArg = parts[1].trim().toLowerCase();
    
    if (availableModels.includes(modelArg)) {
      model = modelArg;
    } else {
      return sendMessage(sock, sender, `❌ Model tidak valid.\n\nPilihan yang tersedia:\n- ${availableModels.join('\n- ')}`, { quoted: message });
    }
  }

  if (!userQuery) {
     return sendMessage(sock, sender, `Pertanyaan tidak boleh kosong.`, { quoted: message });
  }
  
  let progressMsg;
  try {
    await react(sock, sender, message.key, '✈️');
    progressMsg = await sendMessage(sock, sender, `✈️ Copilot (*${model}*) sedang memikirkan jawaban untuk:\n\n*${userQuery}*...`, { quoted: message });

    const apiUrl = `https://szyrineapi.biz.id/api/ai/copilot?q=${encodeURIComponent(userQuery)}&model=${model}&apikey=${config.SZYRINE_API_KEY}`;
    
    const response = await axios.get(apiUrl, { timeout: 180000 }); // Timeout 3 menit

    // Struktur respons API baru tampaknya langsung di 'result.text'
    if (response.data?.result?.text) {
      const answer = response.data.result.text;
      await editMessage(sock, sender, answer, progressMsg.key);
    } else {
      throw new Error('Respons API tidak valid atau tidak berisi teks jawaban.');
    }

  } catch (error) {
    console.error("[COPILOT COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.response?.data?.message || error.message || "Terjadi kesalahan.";
    
    if (progressMsg) {
        await editMessage(sock, sender, `❌ Gagal menghubungi Copilot: ${errorMessage}`, progressMsg.key);
    } else {
        await sendMessage(sock, sender, `❌ Gagal menghubungi Copilot: ${errorMessage}`, { quoted: message });
    }
  }
}