// /modules/general/stats.js (FIXED)

import { config } from '../../config.js';
import { sendMessage } from '../../helper.js';

/** 
 * Format durasi dari detik menjadi string yang mudah dibaca.
 */
function formatUptime(seconds) {
    function pad(s) { return (s < 10 ? '0' : '') + s; }
    const days = Math.floor(seconds / (24 * 3600));
    seconds %= (24 * 3600);
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${days} Hari, ${pad(hours)} Jam, ${pad(minutes)} Menit, ${pad(secs)} Detik`;
}

export default async function stats(sock, msg, args, query, sender, extras) {
    const { commands } = extras;
    const uptime = formatUptime(process.uptime());
    const featureCount = new Set(commands.values()).size;
    
    // [PERBAIKAN] Menggunakan format yang lebih kompatibel
    const currentDate = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        dateStyle: 'full',
        timeStyle: 'medium'
    });

    const statsText = `
*📊 STATISTIK ${config.botName.toUpperCase()}*

*🕒 Waktu Aktif:*
   └ ${uptime}

*⚙️ Total Fitur:*
   └ ${featureCount} Perintah Unik

*🗓️ Waktu Server Saat Ini:*
   └ ${currentDate}

*Terima kasih telah menggunakan bot ini!*
    `.trim();

    await sendMessage(sock, sender, statsText, { quoted: msg });
}

export const category = 'General';
export const description = 'Menampilkan statistik dan waktu aktif bot.';
export const usage = `${config.BOT_PREFIX}stats`;
export const aliases = ['status', 'botstats'];