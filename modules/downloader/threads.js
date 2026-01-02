// /modules/downloaders/threads.js (ENDPOINT BARU)

import { config } from '../../config.js';
import { handleApiDownloader } from '../../libs/downloaderHandler.js';
import { sendMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh media (foto/video) dari Threads.';
export const usage = `${config.BOT_PREFIX}threads <url>`;
export const aliases = ['threads-dl', 'threaddl'];

// --- FUNGSI UTAMA ---
export default async function threads(sock, msg, args, query) {
    const url = query;
    if (!url || !/(?:https?:\/\/)?(?:www\.)?threads\.net\//.test(url)) {
        return sendMessage(sock, msg.key.remoteJid, `Silakan berikan link Threads yang valid.\n\n*Contoh:*\n\`${usage}\``, { quoted: msg });
    }

    await handleApiDownloader(sock, msg, url, {
        platformName: 'Threads',
        apiUrl: 'https://szyrineapi.biz.id/api/dl/threads', // <-- ENDPOINT DIPERBARUI
        captionFormatter: (result) => {
            const user = result.author;
            return `*${user.fullName}* (@${user.username})\n\n${result.caption}\n\n❤️ ${result.like_count} | 💬 ${result.reply_count}\n\nDiunduh oleh ${config.botName}`;
        }
    });
}

export const cost = 5;
