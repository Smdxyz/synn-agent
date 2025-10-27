// modules/utilities/upload.js (VERSI PERBAIKAN DENGAN EKSTENSI OTOMATIS & API BARU)

import { sendMessage, react, downloadMedia, editMessage, delay } from '../../helper.js';
import { config } from '../../config.js';
import FormData from 'form-data';
import axios from 'axios';

// --- METADATA COMMAND ---
export const category = 'Utilities';
export const description = 'Mengunggah gambar/video ke host dan mendapatkan direct link.';
export const usage = `${config.BOT_PREFIX}upload`;
export const aliases = ['up', 'tourl'];

/**
 * Konversi MIME type menjadi ekstensi file yang umum.
 * @param {string} mime Mime type, e.g., 'image/jpeg'
 * @returns {string} Ekstensi file, e.g., 'jpg'
 */
const mimeToExtension = (mime) => {
    if (!mime) return 'dat';
    const mimeMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/x-matroska': 'mkv',
        'application/pdf': 'pdf',
    };
    return mimeMap[mime] || mime.split('/')[1] || 'dat';
};


// --- FUNGSI UTAMA COMMAND ---
export default async function upload(sock, message, args, query, sender) {
  const mediaData = await downloadMedia(message); 
  
  if (!mediaData || !mediaData.buffer) {
    return sendMessage(sock, sender, 'Kirim atau balas sebuah gambar/video/stiker untuk diunggah.', { quoted: message });
  }

  const { buffer: fileBuffer, mimetype } = mediaData;
  
  await react(sock, sender, message.key, '📤');
  const waitingMsg = await sendMessage(sock, sender, `🛰️ Menghubungi server host...`, { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    // --- Animasi Tunggu ---
    await delay(1500);
    await editMessage(sock, sender, `📤 Mengunggah file Anda...`, messageKey);
    // -----------------------

    const form = new FormData();
    
    const extension = mimeToExtension(mimetype);
    const filename = `synn-upload-${Date.now()}.${extension}`;
    
    // PERBAIKAN PENTING: Sertakan contentType untuk stabilitas
    form.append('file', fileBuffer, { filename: filename, contentType: mimetype });

    // Endpoint baru tidak memerlukan API Key atau parameter expiry
    const { data } = await axios.post(`https://szyrineapi.biz.id/api/utility/upload`, form, { 
      headers: form.getHeaders() 
    });

    if (data.result?.success && data.result?.file?.url) {
      const res = data.result.file;
      const replyText = `*✅ Upload Berhasil!*\n\n🔗 *Link:* ${res.url}\n🕒 *Hapus Dalam:* ${res.expires}`;
      await editMessage(sock, sender, replyText, messageKey);
    } else {
      throw new Error(data.result?.message || 'Gagal mengunggah file.');
    }
  } catch (error) {
    console.error("[UPLOAD] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan tidak diketahui.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}