// modules/ai/txt2img.js

import got from 'got';
import H from '../../helper.js'; // Pastikan path ini benar

export const name = 'txt2img';
export const aliases = ['toimage', 'aicreate', 'imagine'];
export const category = 'ai';
export const help = `Membuat gambar dari teks menggunakan AI (Pixnova).

Gunakan pemisah | untuk mengatur style. Jika tidak ada style, akan menggunakan "No Style".
Daftar style bisa dilihat di dokumentasi SzyrineAPI.

*Contoh Penggunaan:*
- .txt2img seekor naga api di atas gunung
- .txt2img kucing lucu memakai kacamata | style: Anime
- .toimage pemandangan kota cyberpunk di malam hari | style: Cyberpunk
`;

// Daftar beberapa style yang umum untuk referensi
const availableStyles = [
    'No Style', '3D', 'Lego blocks', 'Blindbox', 'Pixel', 'Barbie Doll', 
    'Oil Painting', 'Watercolor', 'Sketch', 'Van Gogh', 'Ink scenery', 
    'Paper Cut', 'Doodle', 'Cyberpunk', 'Dark Fantasy', 'Steampunk', 
    'Chinese', 'Abstract', 'Caricature', 'Anime', 'Chibi', 'Comic', 
    'Studio Ghibli', 'Pokemon', 'Furry', '2.5D', 'Pixar'
].map(s => s.toLowerCase());


export default async function (sock, message, args, query, sender, extras) {
    if (!query) {
        return H.sendMessage(sock, sender, `Silakan berikan deskripsi gambar yang ingin dibuat.\n\nLihat contoh penggunaan dengan mengetik *.help ${name}*`, { quoted: message });
    }

    // --- Logika Parsing Cerdas untuk Prompt dan Style ---
    const parts = query.split('|');
    const prompt = parts[0].trim();
    let style = 'No Style'; // Default style

    if (parts.length > 1 && parts[1].toLowerCase().includes('style:')) {
        const styleQuery = parts[1].split(':')[1].trim().toLowerCase();
        // Cek apakah style yang diminta ada di daftar (opsional, tapi bagus untuk validasi)
        if (availableStyles.includes(styleQuery)) {
            // Ubah kembali ke format Case yang benar jika diperlukan (API mungkin case-sensitive)
            style = availableStyles.find(s => s === styleQuery);
            // Re-capitalize the first letter of each word
            style = style.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            if (style === '3d') style = '3D'; // Special case for 3D
            if (style === '2.5d') style = '2.5D'; // Special case for 2.5D
        } else {
             // Jika style tidak ditemukan, kita bisa kirim pesan error atau tetap pakai style yang diinput user
             style = parts[1].split(':')[1].trim(); // Percayakan pada API
             H.sendMessage(sock, sender, `⚠️ *Peringatan:* Style "${style}" tidak ada dalam daftar yang diketahui. Hasil mungkin tidak sesuai.`, { quoted: message });
        }
    }
    
    // Kirim pesan tunggu
    const waitingMsg = await H.sendMessage(sock, sender, '⏳ Sedang melukis imajinasimu... Mohon tunggu sebentar.', { quoted: message });

    try {
        const apiUrl = 'https://szyrineapi.biz.id/api/img/pixnova/text-to-image';
        const payload = {
            prompt: prompt,
            style: style,
            aspectRatio: '1:1' // Default ke kotak, bisa diubah ke '9:16' atau '16:9' jika perlu
        };

        // 1. Kirim permintaan awal untuk mendapatkan statusUrl
        const initialResponse = await got.post(apiUrl, {
            json: payload,
            responseType: 'json'
        }).json();

        if (!initialResponse.result || !initialResponse.result.statusUrl) {
            throw new Error(initialResponse.result?.message || 'Gagal memulai proses pembuatan gambar.');
        }

        const statusUrl = initialResponse.result.statusUrl;

        // 2. Gunakan helper untuk menunggu hasil gambar
        const imageUrl = await H.pollPixnovaJob(statusUrl);

        if (!imageUrl) {
            throw new Error('Gagal mendapatkan URL gambar dari hasil proses.');
        }

        // 3. Kirim gambar ke pengguna
        await H.sendImage(sock, sender, imageUrl, `*Prompt:* ${prompt}\n*Style:* ${style}`, false, { quoted: message });
        
        // Hapus pesan tunggu
        await H.deleteMessage(sock, sender, waitingMsg.key);

    } catch (error) {
        console.error(`[TXT2IMG ERROR]`, error);
        // Edit pesan tunggu menjadi pesan error
        await H.editMessage(sock, sender, `❌ Gagal membuat gambar: ${error.message}`, waitingMsg.key);
    }
}