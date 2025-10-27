// /modules/downloader/igdl.js (REMASTERED)

import { config } from '../../config.js';
import { sendMessage } from '../../helper.js';
import { handleApiDownloader } from '../../libs/downloaderHandler.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh media (foto/video/reels/carousel) dari Instagram.';
export const usage = `${config.BOT_PREFIX}igdl <url>`;
export const aliases = ['ig', 'instagram', 'instadl'];

// --- FUNGSI UTAMA ---
export default async function igdl(sock, msg, args, query, sender) {
    const url = query;

    if (!url || !/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(p|reel|reels|story|stories)\//.test(url)) {
        return sendMessage(sock, sender, `Silakan berikan link Instagram yang valid.\n\n*Contoh:*\n\`${usage}\``, { quoted: msg });
    }

    await handleApiDownloader(sock, msg, url, {
        platformName: 'Instagram',
        apiUrl: 'https://szyrineapi.biz.id/api/dl/instagram',
        captionFormatter: (result) => {
            let cap = result.caption || '';
            if (result.author?.username) {
                cap += `\n\n*Dari:* ${result.author.username}`;
            }
            return cap.trim();
        }
    });
}