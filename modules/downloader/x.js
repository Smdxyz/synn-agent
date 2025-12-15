// /modules/downloaders/x.js (FIXED FOR NEW API STRUCTURE)

import { config } from '../../config.js';
import { handleApiDownloader } from '../../libs/downloaderHandler.js';
import { sendMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh media (foto/video) dari X (Twitter).';
export const usage = `${config.BOT_PREFIX}x <url>`;
export const aliases = ['twitter', 'twt', 'twitterdl'];

// --- FUNGSI UTAMA ---
export default async function x(sock, msg, args, query) {
    const url = query;
    if (!url || !/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\//.test(url)) {
        return sendMessage(sock, msg.key.remoteJid, `Silakan berikan link X/Twitter yang valid.\n\n*Contoh:*\n\`${usage}\``, { quoted: msg });
    }

    await handleApiDownloader(sock, msg, url, {
        platformName: 'X/Twitter',
        apiUrl: 'https://szyrineapi.biz.id/api/dl/x', // Endpoint sudah benar
        
        // --- PERBAIKAN: Sesuaikan path data dengan respons JSON yang baru ---
        captionFormatter: (result) => {
            const user = result.user;
            const stats = result.stats;
            return `*${user.name}* (@${user.screenName})\n\n${result.text}\n\n❤️ ${stats.likes} | 🔁 ${stats.retweets}\n\nDiunduh oleh ${config.botName}`;
        }
    });
}