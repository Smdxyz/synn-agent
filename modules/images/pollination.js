// modules/ai/pollination.js

import { sendMessage, react, sendImage, editMessage, delay } from '../../helper.js';
import { config } from '../../config.js';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Membuat gambar dari teks menggunakan Pollinations AI.';
export const usage = `${config.BOT_PREFIX}poll <deskripsi gambar>`;
export const aliases = ['pollinations', 'pimg'];

// --- FUNGSI UTAMA COMMAND ---
export default async function pollination(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Masukkan deskripsi gambar.\n\n*Contoh:*\n${usage}`, { quoted: message });
  }
  
  await react(sock, sender, message.key, '🌌');
  const sentMsg = await sendMessage(sock, sender, `⏳ Menyiapkan kanvas digital...`, { quoted: message });
  const messageKey = sentMsg.key;
  
  try {
    // --- Animasi Tunggu ---
    await delay(1000);
    await editMessage(sock, sender, `🎨 Melukis imajinasi Anda: *"${query}"*`, messageKey);
    // -----------------------

    const apiUrl = `https://szyrineapi.biz.id/api/img/create/pollinations?prompt=${encodeURIComponent(query)}`;
    const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

    await sendImage(sock, sender, response.data, `*Prompt:* ${query}\n*${config.WATERMARK}*`, false, { quoted: message });
    await editMessage(sock, sender, '✅ Gambar berhasil dibuat!', messageKey);
  } catch (error) {
    console.error("[POLLINATION COMMAND] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Gagal membuat gambar.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}