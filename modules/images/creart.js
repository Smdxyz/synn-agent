// modules/ai/creart.js

import axios from 'axios';
import { sendMessage, sendImage, react, deleteMessage, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Membuat gambar dari teks menggunakan model CreArt.';
export const usage = `${config.BOT_PREFIX}creart <deskripsi gambar>`;
export const aliases = ['createart', 'aiimg'];

// --- FUNGSI UTAMA COMMAND ---
export default async function creart(sock, message, args, query, sender, extras) {
  if (!query) {
    const exampleText = `Silakan masukkan deskripsi gambar yang ingin Anda buat.\n\n*Contoh:*\n${usage}`;
    return sendMessage(sock, sender, exampleText, { quoted: message });
  }

  await react(sock, sender, message.key, '🎨');
  const waitingMsg = await sendMessage(sock, sender, `✍️ Sedang membuat gambar dengan prompt:\n\n*${query}*...\n\nMohon tunggu, ini mungkin butuh waktu.`, { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const apiUrl = `https://szyrineapi.biz.id/api/images/create/creart?prompt=${encodeURIComponent(query)}`;
    
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer'
    });

    const imageBuffer = Buffer.from(response.data);
    
    await sendImage(sock, sender, imageBuffer, `*Prompt:* ${query}\n*${config.WATERMARK}*`, false, { quoted: message });

    // Edit pesan "sedang membuat..." menjadi "sukses"
    await editMessage(sock, sender, '✅ Gambar berhasil dibuat!', messageKey);

  } catch (error) {
    console.error("[CREART COMMAND] Error:", error.response ? error.response.data.toString() : error.message);
    const errorText = `Maaf, terjadi kesalahan saat membuat gambar. API mungkin sedang bermasalah atau prompt Anda tidak valid.`;
    await editMessage(sock, sender, `❌ Gagal: ${errorText}`, messageKey);
  }
}