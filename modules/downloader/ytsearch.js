// modules/downloader/ytsearch.js (COMMAND BARU)

import got from 'got';
import { config } from '../../config.js';
import { sendMessage, react, editMessage } from '../../helper.js';

export default async function(sock, message, args, query, sender, extras) {
    if (!query) {
        return sendMessage(sock, sender, `❌ Kamu mau cari apa?\nContoh: *${config.BOT_PREFIX}ytsearch jkt48 rapsodi*`, { quoted: message });
    }

    if (!config.SZYRINE_API_KEY || config.SZYRINE_API_KEY === "SANN21") {
        return sendMessage(sock, sender, '❌ API Key belum diatur oleh pemilik bot.');
    }

    let progressMessage;
    const editProgress = (text) => editMessage(sock, sender, text, progressMessage.key);

    try {
        await react(sock, sender, message.key, '🔍');
        progressMessage = await sendMessage(sock, sender, `🔍 Mencari video untuk: *${query}*...`, { quoted: message });

        const searchUrl = `https://szyrineapi.biz.id/api/dl/youtube/search?q=${encodeURIComponent(query)}&apikey=${config.SZYRINE_API_KEY}`;
        const { result: searchResults } = await got(searchUrl).json();

        if (!searchResults || searchResults.length === 0) {
            throw new Error('Tidak ada video yang ditemukan.');
        }

        let replyText = `*🔍 Hasil Pencarian YouTube untuk "${query}"*\n\n`;
        searchResults.slice(0, 10).forEach((video, index) => { // Ambil maks 10 hasil
            replyText += `*${index + 1}. ${video.title}*\n`;
            replyText += `   - Durasi: ${video.duration}\n`;
            replyText += `   - Link: ${video.url}\n\n`;
        });

        await editProgress(replyText);
        await react(sock, sender, message.key, '✅');

    } catch (error) {
        console.error(`[Ytsearch Error]`, error);
        const finalErrorMessage = `❌ Gagal mencari video: ${error.message}`;
        if (progressMessage) {
            await editProgress(finalErrorMessage);
        } else {
            await sendMessage(sock, sender, finalErrorMessage, { quoted: message });
        }
        await react(sock, sender, message.key, '❌');
    }
}

export const aliases = ['youtubesearch', 'carivideo'];
export const category = 'Downloaders';
export const description = 'Mencari video di YouTube.';
export const usage = `${config.BOT_PREFIX}ytsearch <judul video>`;

export const cost = 5;
