// modules/tools/stalktiktok.js

import axios from 'axios';
import { sendMessage, sendImage, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Tools';
export const description = 'Melihat informasi profil pengguna TikTok berdasarkan username.';
export const usage = `${config.BOT_PREFIX}stalktt <username>`;
export const aliases = ['ttstalk', 'tiktokstalk'];

// --- FUNGSI UTAMA COMMAND ---
export default async function stalktiktok(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Masukkan username TikTok yang ingin dicari.\n\n*Contoh:*\n${usage} erinejkt48`, { quoted: message });
  }

  await react(sock, sender, message.key, '👀');
  const waitingMsg = await sendMessage(sock, sender, `⏳ Mencari profil TikTok *${query}*...`, { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const apiUrl = `https://szyrineapi.biz.id/api/tools/stalk/tiktok?username=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
    
    const { data } = await axios.get(apiUrl);

    if (!data.result || !data.result.id) {
      throw new Error(data.message || 'Profil tidak ditemukan atau username tidak valid.');
    }

    const result = data.result;

    // Membuat caption yang kaya informasi
    const caption = `
*${result.nickname}* ${result.verified ? '✅' : ''}
*@${result.uniqueId}*

"${result.signature}"

👥 *Followers:* ${result.followerCount.toLocaleString('id-ID')}
➡️ *Following:* ${result.followingCount.toLocaleString('id-ID')}
❤️ *Total Likes:* ${result.heartCount.toLocaleString('id-ID')}
📹 *Total Videos:* ${result.videoCount.toLocaleString('id-ID')}

🔐 *Akun Private:* ${result.privateAccount ? 'Ya' : 'Tidak'}
    `.trim();

    // Mengirim foto profil medium dengan caption yang sudah dibuat
    await sendImage(sock, sender, result.avatarMedium, caption, false, { quoted: message });
    await editMessage(sock, sender, '✅ Profil berhasil ditemukan!', messageKey);

  } catch (error) {
    console.error("[STALK TIKTOK] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat mencari profil.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}

export const cost = 2;
