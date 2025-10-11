// modules/tools/cekpln.js

import axios from 'axios';
import { sendMessage, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Tools';
export const description = 'Mengecek tagihan listrik PLN berdasarkan ID Pelanggan.';
export const usage = `${config.BOT_PREFIX}cekpln <id_pelanggan>`;
export const aliases = ['pln', 'tagihanpln'];

// --- FUNGSI UTAMA COMMAND ---
export default async function cekpln(sock, message, args, query, sender) {
  if (!query) {
    return sendMessage(sock, sender, `Masukkan ID Pelanggan PLN yang ingin dicek.\n\n*Contoh:*\n${usage} 52200012345`, { quoted: message });
  }

  // Validasi sederhana untuk memastikan input adalah angka
  if (!/^\d+$/.test(query)) {
    return sendMessage(sock, sender, `ID Pelanggan harus berupa angka.`, { quoted: message });
  }

  await react(sock, sender, message.key, '💡');
  const waitingMsg = await sendMessage(sock, sender, `⏳ Mengecek tagihan untuk ID *${query}*...`, { quoted: message });
  const messageKey = waitingMsg.key;

  try {
    const apiUrl = `https://szyrineapi.biz.id/api/tools/pln?id=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
    
    const { data } = await axios.get(apiUrl);

    if (!data.result || !data.result.customer_id) {
      throw new Error(data.message || 'ID Pelanggan tidak ditemukan atau tidak ada tagihan.');
    }

    const result = data.result;

    // Membuat pesan balasan yang rapi
    const replyText = `
*🧾 Informasi Tagihan PLN*

🆔 *ID Pelanggan:* \`${result.customer_id}\`
👤 *Nama:* ${result.customer_name}
💰 *Total Tagihan:* *${result.outstanding_balance}*
🗓️ *Periode:* ${result.billing_period}
⚡ *Daya:* ${result.power_category}
    `.trim();

    // Mengganti pesan "mengecek..." dengan hasil akhir
    await editMessage(sock, sender, replyText, messageKey);

  } catch (error) {
    console.error("[CEK PLN] Error:", error.response ? error.response.data : error.message);
    const errorMessage = error.message || 'Terjadi kesalahan saat mengecek tagihan.';
    await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
  }
}