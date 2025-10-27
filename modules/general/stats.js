// /modules/general/stats.js (Tampilan Disederhanakan)

import { config } from '../../config.js';
import { sendMessage } from '../../helper.js';

/** 
 * Format durasi dari detik menjadi string yang mudah dibaca.
 */
function formatUptime(seconds) {
    function pad(s) { return (s < 10 ? '0' : '') + s; }
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor(seconds / 60) % 60;
    const secs = Math.floor(seconds % 60);
    
    let uptimeString = '';
    if (days > 0) uptimeString += `${days}d `;
    if (hours > 0 || days > 0) uptimeString += `${pad(hours)}h `;
    if (minutes > 0 || hours > 0 || days > 0) uptimeString += `${pad(minutes)}m `;
    uptimeString += `${pad(secs)}s`;
    
    return uptimeString.trim();
}

export default async function stats(sock, msg, args, query, sender, extras) {
    const { commands } = extras;
    const uptime = formatUptime(process.uptime());
    const featureCount = new Set(commands.values()).size;
    
    const statsText = `
*📊 Bot Status*

*┌ Waktu Aktif:* \`${uptime}\`
*└ Total Fitur:* \`${featureCount} Perintah\`

*Powered by ${config.botName}*
    `.trim();

    await sendMessage(sock, sender, statsText, { quoted: msg });
}

export const category = 'General';
export const description = 'Menampilkan statistik dan waktu aktif bot.';
export const usage = `${config.BOT_PREFIX}stats`;
export const aliases = ['status', 'botstats'];