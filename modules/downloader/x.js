// /modules/downloaders/x.js (ENDPOINT BARU)

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
        apiUrl: 'https://szyrineapi.biz.id/api/dl/twitter', // <-- ENDPOINT DIPERBARUI
        captionFormatter: (result) => {
            const user = result.author;
            return `*${user.name}* (@${user.screen_name})\n\n${result.full_text}\n\n❤️ ${result.favorite_count} | 🔁 ${result.retweet_count}\n\nDiunduh oleh ${config.botName}`;
        }
    });
}