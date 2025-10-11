// /modules/ytmp3.js (FINAL & ALWAYS MP3)

import { config } from '../../config.js';
// Pastikan path ke utils.js benar jika Anda memilikinya, jika tidak hapus baris ini
// import { formatBytes } from '../../libs/utils.js'; 
import { sendMessage, sendAudio, editMessage } from '../../helper.js';
import { downloadYouTubeAudio } from '../../libs/youtubeDownloader.js';

// Fungsi formatBytes jika Anda tidak punya file utils.js terpisah
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


export default async function execute(sock, msg, args) {
    const sender = msg.key.remoteJid;
    const userUrl = args[0];
    
    // --- PERUBAHAN UTAMA ---
    // Variabel ini sekarang diatur ke 'false' secara permanen.
    // Bot tidak akan pernah mengirim voice note, bahkan jika command !ytvn digunakan.
    const sendAsVoiceNote = false;

    if (!userUrl || !/^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.be)\/.+$/.test(userUrl)) {
        return sendMessage(sock, sender, `Format salah.\nContoh: *${config.BOT_PREFIX}ytmp3 <url_youtube>*`, { quoted: msg });
    }

    // Pesan awal sekarang selalu untuk MP3
    const initialMessage = '⏳ Oke, memproses MP3...';
    const progressMessage = await sock.sendMessage(sender, { text: initialMessage }, { quoted: msg });
    const editProgress = (text) => editMessage(sock, sender, text, progressMessage.key);

    try {
        const { title, buffer } = await downloadYouTubeAudio(userUrl, editProgress);
        
        await editProgress('✅ Audio berhasil diunduh. Mengirim ke kamu...');
        const cleanTitle = title.replace(/[^\w\s.-]/gi, '') || 'youtube-audio';

        // --- PERBAIKAN BUG UTAMA ---
        // Panggilan fungsi sendAudio sudah diperbaiki.
        // Properti 'ptt' (Push-to-Talk) sekarang berada di dalam objek options
        // dan nilainya diambil dari variabel sendAsVoiceNote yang sudah kita set ke false.
        await sendAudio(sock, sender, buffer, { 
            ptt: sendAsVoiceNote, 
            mimetype: 'audio/mp4', 
            fileName: `${cleanTitle}.mp3`, 
            quoted: msg 
        });

        const fileSize = formatBytes(buffer.length);
        // Pesan akhir sekarang juga sudah disederhanakan
        const finalMessage = `✅ *Proses Selesai!*\n\n*Judul:* ${title}\n*Ukuran:* ${fileSize}`;
            
        await editProgress(finalMessage);

    } catch (error) {
        console.error("Error di ytmp3:", error); // Tambahkan log error untuk debugging
        await editProgress(`❌ Aduh, gagal:\n${error.message}`);
    }
}

export const category = 'Downloaders';
export const description = 'Mengunduh audio dari YouTube sebagai MP3.';
export const usage = `${config.BOT_PREFIX}ytmp3 <url>`; // Usage disederhanakan
export const aliases = ['ytvn']; // Alias tetap dipertahankan agar command tetap bisa dipakai