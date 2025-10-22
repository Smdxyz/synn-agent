// /modules/downloaders/x.js

import { config } from '../../config.js';
import { handleApiDownloader } from '../../libs/downloaderHandler.js';
import { sendMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh media (foto/video) dari X (Twitter).';
export const usage = `${config.BOT_PREFIX}x <url>`;
export const aliases = ['twitter', 'twt', 'twitterdl'];

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args) {
    const url = args[0];
    if (!url || !/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\//.test(url)) {
        return sendMessage(sock, msg.key.remoteJid, `Silakan berikan link X/Twitter yang valid.\n\n*Contoh:*\n\`${config.BOT_PREFIX}x https://x.com/username/status/12345\``, { quoted: msg });
    }

    await handleApiDownloader(sock, msg, url, {
        platformName: 'X/Twitter',
        apiUrl: 'https://szyrineapi.biz.id/api/downloaders/x',
        captionFormatter: (result) => {
            const user = result.user;
            return `*${user.name}* (@${user.screenName})\n\n${result.text}\n\n❤️ ${result.stats.likes} | 🔁 ${result.stats.retweets} | 👁️ ${result.views}\n\nDiunduh oleh ${config.BOT_NAME}`;
        }
    });
}