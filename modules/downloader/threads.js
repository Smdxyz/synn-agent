// /modules/downloaders/threads.js

import { config } from '../../config.js';
import { handleApiDownloader } from '../../libs/downloaderHandler.js';
import { sendMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh media (foto/video) dari Threads.';
export const usage = `${config.BOT_PREFIX}threads <url>`;
export const aliases = ['threads-dl', 'threaddl'];

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args) {
    const url = args[0];
    if (!url || !/(?:https?:\/\/)?(?:www\.)?threads\.net\//.test(url)) {
        return sendMessage(sock, msg.key.remoteJid, `Silakan berikan link Threads yang valid.\n\n*Contoh:*\n\`${config.BOT_PREFIX}threads https://www.threads.net/@username/post/xxxx\``, { quoted: msg });
    }

    await handleApiDownloader(sock, msg, url, {
        platformName: 'Threads',
        apiUrl: 'https://szyrineapi.biz.id/api/downloaders/threads',
        captionFormatter: (result) => {
            const user = result.user;
            return `*${user.fullName}* (@${user.username})\n\n${result.text}\n\n❤️ ${result.stats.likes} | 💬 ${result.stats.replies}\n\nDiunduh oleh ${config.BOT_NAME}`;
        }
    });
}