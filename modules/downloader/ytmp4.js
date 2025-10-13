// modules/downloaders/ytmp4.js

import { sendMessage, sendVideo, react, editMessage } from '../../helper.js';
import { config } from '../../config.js';
import { getDownloadLink } from '../../libs/og-downloader.js'; // <-- IMPORT LOGIKA BARU

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh video dari YouTube sebagai file MP4 (metode baru).';
export const usage = `${config.BOT_PREFIX}ytmp4 <url_video_youtube>`;
export const aliases = ['ytv', 'ytvideo'];

// --- FUNGSI UTAMA COMMAND ---
export default async function ytmp4(sock, message, args, query, sender) {
    if (!query || (!query.includes('youtube.com') && !query.includes('youtu.be'))) {
        return sendMessage(sock, sender, `Masukkan URL video YouTube yang valid.\n\n*Contoh:*\n${usage}`, { quoted: message });
    }

    await react(sock, sender, message.key, '🎬');
    const waitingMsg = await sendMessage(sock, sender, '⏳ Memulai proses download video...', { quoted: message });
    const messageKey = waitingMsg.key;

    const animationFrames = ['[⠟]', '[⠯]', '[⠷]', '[⠾]', '[⠽]', '[⠻]'];
    let lastEditTime = 0;

    try {
        const onProgress = async (status, attempt, max) => {
            const now = Date.now();
            // Batasi pengeditan pesan, maksimal setiap 2.5 detik untuk keamanan
            if (now - lastEditTime > 2500) {
                const frame = animationFrames[attempt % animationFrames.length];
                const progressText = max > 0 ? `(${attempt}/${max})` : '';
                await editMessage(sock, sender, `${frame} ${status} ${progressText}`, messageKey);
                lastEditTime = now;
            }
        };

        const result = await getDownloadLink(query, { format: 'mp4', onProgress });

        if (result) {
            const { title, downloadUrl } = result;
            const caption = `*${title}*\n\n*${config.WATERMARK}*`;
            
            await editMessage(sock, sender, '📥 Mengirim file video...', messageKey);
            await sendVideo(sock, sender, downloadUrl, caption, { quoted: message });
            await editMessage(sock, sender, '✅ Video berhasil diunduh!', messageKey);
        } else {
            throw new Error('Gagal mendapatkan link download final.');
        }

    } catch (error) {
        console.error("[YTMP4 DOWNLOADER] Error:", error.message);
        const errorMessage = error.message || 'Terjadi kesalahan saat mengunduh video.';
        await editMessage(sock, sender, `❌ Gagal: ${errorMessage}`, messageKey);
    }
}