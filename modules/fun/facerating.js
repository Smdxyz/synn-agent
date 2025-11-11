// modules/fun/facerating.js (VISUAL REMASTERED - FINAL FIX)

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js';
import { config } from '../../config.js';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { join } from 'path';

// --- METADATA COMMAND ---
export const category = 'Fun';
export const description = 'Memberi rating pada wajah di gambar menggunakan AI.';
export const usage = `${config.BOT_PREFIX}rate`;
export const aliases = ['facerate', 'rateface', 'howhot'];

// --- FUNGSI PEMBUAT GAMBAR (VISUAL DIPERBAIKI TOTAL) ---
async function createRatingImage(userImageUrl, data) {
    try {
        const assetsPath = join(process.cwd(), 'assets', 'fonts');
        registerFont(join(assetsPath, 'Poppins-Bold.ttf'), { family: 'Poppins', weight: 'bold' });
        registerFont(join(assetsPath, 'Poppins-Regular.ttf'), { family: 'Poppins', weight: 'normal' });
    } catch (e) {
        console.warn("[FaceRating] Font kustom tidak ditemukan, menggunakan font default.");
    }
    
    const fontFamily = 'Poppins, sans-serif';
    const width = 800;
    const height = 950; // Sedikit lebih tinggi untuk spasi
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- Latar Belakang Gelap Modern ---
    ctx.fillStyle = '#14192D'; // Dark Navy Blue
    ctx.fillRect(0, 0, width, height);

    // --- Posisi & Ukuran Utama ---
    const centerX = width / 2;
    const avatarY = 200;
    const avatarRadius = 110;

    // --- Teks Prediksi (DI ATAS AVATAR) ---
    ctx.fillStyle = '#E0E0E0';
    ctx.font = `normal 28px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
        `Prediksi Umur: ${data.age} | Gender: ${data.gender === 'male' ? 'Pria' : 'Wanita'}`,
        centerX, 
        avatarY - avatarRadius - 40 // Posisi Y di atas lingkaran
    );

    // --- Gambar Profil & Lingkaran Skor ---
    // 1. Gambar avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    try {
        const avatar = await loadImage(userImageUrl);
        ctx.drawImage(avatar, centerX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    } catch (e) {
        console.error("Gagal memuat gambar profil untuk canvas:", e);
    }
    ctx.restore();

    // 2. Overlay gelap semi-transparan (agar skor lebih terbaca)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(centerX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.fill();
    
    // 3. Teks Skor Utama (di tengah avatar)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 85px ${fontFamily}`;
    ctx.fillText(data.face_score, centerX, avatarY);

    // 4. Lingkaran progress bar di sekeliling avatar
    const ringRadius = avatarRadius + 15;
    ctx.save();
    ctx.translate(centerX, avatarY);
    ctx.rotate(-Math.PI / 2); // Mulai dari atas
    
    // Lingkaran latar gelap
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.stroke();

    // Lingkaran skor (Gradient)
    const gradient = ctx.createLinearGradient(0, -ringRadius, 0, ringRadius);
    gradient.addColorStop(0, '#A052E8'); // Ungu
    gradient.addColorStop(1, '#E8527A'); // Merah muda
    
    const endAngle = (data.face_score / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, endAngle);
    ctx.strokeStyle = gradient;
    ctx.stroke();
    ctx.restore();

    // --- Garis Pemisah ---
    const separatorY = avatarY + avatarRadius + 80;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, separatorY);
    ctx.lineTo(width - 80, separatorY);
    ctx.stroke();
    
    // --- Detail Rating Bars (DENGAN LAYOUT YANG BENAR) ---
    const startY = separatorY + 60;
    const lineHeight = 65;
    const labelsX = 80; // Posisi X untuk semua label
    const barsX = 350; // Posisi X untuk semua bar (memberi ruang cukup)
    const barWidth = width - barsX - 80;
    const barHeight = 10;

    const translations = {
        'Attractiveness': 'Daya Tarik',
        'Confidence': 'Kepercayaan Diri',
        'Approachability': 'Keramahan',
        'Trustworthiness': 'Kepercayaan',
        'Smartness': 'Kecerdasan',
        'Fun': 'Keceriaan'
    };

    const ratings = [
        { label: 'Attractiveness', value: data.attractiveness * 20 },
        { label: 'Confidence', value: data.confidence * 20 },
        { label: 'Approachability', value: data.approachability * 20 },
        { label: 'Trustworthiness', value: data.trustworthiness * 20 },
        { label: 'Smartness', value: data.smartness * 20 },
        { label: 'Fun', value: data.fun * 20 },
    ];

    ratings.forEach((item, index) => {
        const y = startY + (index * lineHeight);
        
        // Teks Label (diterjemahkan)
        ctx.fillStyle = '#E0E0E0';
        ctx.font = `normal 28px ${fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(translations[item.label] || item.label, labelsX, y);

        // Bar Skor (Gaya Baru)
        const filledWidth = (item.value / 100) * barWidth;
        const barGradient = ctx.createLinearGradient(barsX, 0, barsX + barWidth, 0);
        barGradient.addColorStop(0, '#A052E8'); // Ungu
        barGradient.addColorStop(1, '#E8527A'); // Merah muda

        // Bagian "kosong" (gelap) digambar dulu
        ctx.fillStyle = '#1F253D';
        ctx.fillRect(barsX, y - barHeight / 2, barWidth, barHeight);
        
        // Bagian yang terisi digambar di atasnya
        ctx.fillStyle = barGradient;
        ctx.fillRect(barsX, y - barHeight / 2, filledWidth, barHeight);
    });

    return canvas.toBuffer('image/jpeg');
}


// --- FUNGSI UTAMA COMMAND (TIDAK ADA PERUBAHAN) ---
export default async function facerating(sock, message, args, query, sender, extras) {
    // ... (Logika ini sudah benar dan tidak perlu diubah)
    const m = message;
    const jid = m.key.remoteJid;
    const media = await H.downloadMedia(m);
    if (!media) return H.sendMessage(sock, jid, '❌ *Gambar tidak ditemukan!*\n\nKirim atau balas gambar dengan caption `!rate`', { quoted: m });
    const { buffer, mimetype } = media;
    await H.react(sock, jid, m.key, '🧐');
    const sentMsg = await H.sendMessage(sock, jid, '🔬 Menganalisis wajah Anda...', { quoted: m });
    const messageKey = sentMsg.key;
    try {
        const userImageUrl = await H.uploadImage(buffer, mimetype);
        if (!userImageUrl) throw new Error('Gagal mengunggah gambar Anda.');
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });
        await H.editMessage(sock, jid, `🤖 Mengirim gambar ke AI...`, messageKey);
        const { data: initialResponse } = await axios.post('https://szyrineapi.biz.id/api/img/pixnova/face-rating', form, { headers: form.getHeaders() });
        if (initialResponse?.status !== 200 || !initialResponse.result?.statusUrl) throw new Error(initialResponse.message || 'Gagal memulai proses di API.');
        const { statusUrl } = initialResponse.result;
        await H.editMessage(sock, jid, `⏳ Menunggu hasil dari AI...`, messageKey);
        await H.pollPixnovaJob(statusUrl);
        const { data: finalResult } = await axios.get(statusUrl);
        if (finalResult.result?.status !== 'completed' || !finalResult.result.result) throw new Error('API gagal memproses atau hasil tidak valid.');
        await H.editMessage(sock, jid, `🎨 Menggambar hasil analisis...`, messageKey);
        const ratingImageBuffer = await createRatingImage(userImageUrl, finalResult.result.result);
        const caption = `*✨ Hasil Analisis Wajah ✨*\n\n` +
                        `*Skor Total:* ${finalResult.result.result.face_score}/100\n` +
                        `*Gender:* ${finalResult.result.result.gender === 'male' ? 'Pria' : 'Wanita'}\n` +
                        `*Prediksi Umur:* ${finalResult.result.result.age} tahun\n\n` +
                        `_${config.WATERMARK}_\n\n` +
                        `*Catatan:* Hasil ini hanya untuk hiburan. Setiap individu unik dan berharga. ❤️`;
        await H.sendImage(sock, jid, ratingImageBuffer, caption, false, { quoted: m });
        await H.editMessage(sock, jid, `✅ Analisis selesai!`, messageKey);
    } catch (error) {
        console.error("FaceRating Command Error:", error);
        const errorMessage = error.response?.data?.message || error.message || "Terjadi kesalahan.";
        await H.editMessage(sock, jid, `❌ Gagal menganalisis: ${errorMessage}`, messageKey);
    }
}