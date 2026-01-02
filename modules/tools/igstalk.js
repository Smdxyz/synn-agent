// modules/tools/stalkig.js

import axios from 'axios';
import { sendMessage, sendImage, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Tools';
export const description = 'Melihat informasi profil pengguna Instagram berdasarkan username.';
export const usage = `${config.BOT_PREFIX}stalkig <username>`;
export const aliases = ['igstalk', 'instagramstalk'];

// --- FUNGSI UTAMA COMMAND ---
export default async function stalkig(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Masukkan username Instagram yang ingin dicari.\n\n*Contoh:*\n${usage} jkt48.erine`, { quoted: message });
  }

  // Menghilangkan simbol '@' jika pengguna memasukkannya
  const username = query.replace('@', '');

  await react(sock, sender, message.key, '📸');
  const waitingMsg = await sendMessage(sock, sender, `⏳ Mencari profil Instagram *${username}*...`, { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const apiUrl = `https://szyrineapi.biz.id/api/tools/stalk/instagram?username=${encodeURIComponent(username)}&apikey=${config.SZYRINE_API_KEY}`;
    
    const { data } = await axios.get(apiUrl);

    if (!data.result || !data.result.username) {
      throw new Error(data.message || 'Profil tidak ditemukan atau username tidak valid.');
    }

    const result = data.result;
    const stats = result.statistics;

    // Membuat caption yang kaya informasi
    const caption = `
*${result.full_name}* ${result.is_verified ? '✅' : ''}
*@${result.username}*

${result.bio}

👥 *Followers:* ${stats.followers}
➡️ *Following:* ${stats.following}
🖼️ *Posts:* ${stats.posts}
    `.trim();

    // Mengirim foto profil dengan caption yang sudah dibuat
    await sendImage(sock, sender, result.profile_picture, caption, false, { quoted: message });
    await editMessage(sock, sender, '✅ Profil berhasil ditemukan!', messageKey);

  } catch (error) {
    console.error("[STALK INSTAGRAM] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat mencari profil.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}

export const cost = 2;
