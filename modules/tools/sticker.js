// modules/sticker/sticker.js

import sharp from 'sharp';
import H from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const name = 'sticker';
export const aliases = ['s', 'stiker', 'sgif'];
export const category = 'Sticker';
export const help = `Membuat stiker dari gambar, video, atau GIF.

*Cara Penggunaan:*
- Kirim atau balas media dengan caption *.s*
- Untuk stiker animasi, kirim video/GIF (maks. 7 detik).
- Untuk custom pack & author, gunakan pemisah |
  Contoh: *.s Pack Saya | Author Saya*

*Alias:*
- .sticker
- .stiker
- .sgif (untuk animasi)
`;

// --- FUNGSI UTAMA COMMAND ---
export default async function createSticker(sock, message, args, query, sender) {
    // --- Ambil Media ---
    // Cek dulu apakah pesan asli mengandung video untuk mendapatkan durasinya
    const originalMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || message.message;
    const media = await H.downloadMedia(message);

    if (!media) {
        return H.sendMessage(sock, sender, '❌ Kirim atau balas gambar/video untuk dijadikan stiker.', { quoted: message });
    }

    const { buffer, mimetype } = media;

    // --- Parse Pack & Author ---
    const [packname, author] = (query || '').split('|').map(s => s.trim());
    const stickerMetadata = {
        pack: packname || config.PACK_NAME || 'Synn-Agent',
        author: author || config.AUTHOR_NAME || 'Sann',
        // Tambahkan kategori jika ingin stiker muncul di pencarian WhatsApp
        categories: ['👋'], 
    };

    await H.react(sock, sender, message.key, '🤖');
    const waitingMsg = await H.sendMessage(sock, sender, '⏳ Sedang membuat stiker...', { quoted: message });

    try {
        let stickerBuffer;

        // --- Proses Stiker Animasi (Video/GIF) ---
        if (mimetype.startsWith('video/') || mimetype === 'image/gif') {
            const duration = originalMessage?.videoMessage?.seconds || 0;
            if (duration > 7) {
                throw new Error('Video terlalu panjang! Maksimal durasi untuk stiker adalah 7 detik.');
            }
            // Untuk animasi, kita serahkan buffer video/gif langsung ke Baileys
            // Baileys akan mengkonversinya menggunakan ffmpeg (pastikan terinstall di sistem)
            stickerBuffer = buffer;
            stickerMetadata.animated = true;
        
        // --- Proses Stiker Statis (Gambar) ---
        } else if (mimetype.startsWith('image/')) {
            // Gunakan Sharp untuk memproses gambar agar optimal
            stickerBuffer = await sharp(buffer)
                .resize({
                    width: 512,
                    height: 512,
                    fit: 'contain', // Menjaga aspek rasio, sisa ruang jadi transparan
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 90 }) // Konversi ke WebP dengan kualitas bagus
                .toBuffer();
            stickerMetadata.animated = false;
        
        // --- Tipe File Tidak Didukung ---
        } else {
            throw new Error(`Tipe file "${mimetype}" tidak didukung untuk dijadikan stiker.`);
        }

        // --- Kirim Stiker ---
        await sock.sendMessage(sender, { 
            sticker: stickerBuffer, 
            ...stickerMetadata 
        }, { quoted: message });
        
        await sock.sendMessage(sender, { delete: waitingMsg.key });

    } catch (error) {
        console.error(`[STICKER MAKER ERROR]`, error);
        await H.editMessage(sock, sender, `❌ Gagal membuat stiker: ${error.message}`, waitingMsg.key);
    }
}