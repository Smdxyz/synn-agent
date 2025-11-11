// modules/fun/facerating.js (VISUAL REMASTERED)

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

// --- FUNGSI PEMBUAT GAMBAR (VISUAL BARU) ---
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
    const height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // --- Latar Belakang Gelap Modern ---
    ctx.fillStyle = '#14192D'; // Dark Navy Blue
    ctx.fillRect(0, 0, width, height);

    // --- Gambar Profil & Lingkaran Skor (Bagian Utama) ---
    const centerX = width / 2;
    const avatarY = 180;
    const avatarRadius = 120;
    
    // 1. Gambar avatar sebagai latar belakang, dipotong melingkar
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
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(centerX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    }
    ctx.restore();

    // 2. Tambahkan overlay gelap agar teks mudah dibaca
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(centerX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.fill();

    // 3. Gambar lingkaran progress bar di sekeliling avatar
    ctx.save();
    const ringRadius = avatarRadius + 15;
    ctx.translate(centerX, avatarY);
    ctx.rotate(-Math.PI / 2); // Mulai dari atas
    
    // Lingkaran latar
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    // Lingkaran skor (Gradient)
    const gradient = ctx.createLinearGradient(-ringRadius, -ringRadius, ringRadius, ringRadius);
    gradient.addColorStop(0, '#A052E8'); // Ungu
    gradient.addColorStop(1, '#E8527A'); // Merah muda
    
    const endAngle = (data.face_score / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, endAngle);
    ctx.strokeStyle = gradient;
    ctx.stroke();
    ctx.restore();

    // 4. Tulis teks di dalam lingkaran
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';

    // Teks Prediksi Umur & Gender
    ctx.font = `normal 24px ${fontFamily}`;
    ctx.fillText(`Predicted Age: ${data.age} | Gender: ${data.gender.charAt(0).toUpperCase() + data.gender.slice(1)}`, centerX, avatarY - 40);

    // Teks Skor Utama
    ctx.font = `bold 80px ${fontFamily}`;
    ctx.fillText(data.face_score, centerX, avatarY + 20);

    // --- Garis Pemisah ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, avatarY + avatarRadius + 80);
    ctx.lineTo(width - 100, avatarY + avatarRadius + 80);
    ctx.stroke();
    
    // --- Detail Rating Bars ---
    const startY = avatarY + avatarRadius + 140;
    const lineHeight = 60;
    const barX = 300;
    const barWidth = width - barX - 100;
    const barHeight = 10;

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
        
        // Teks Label
        ctx.fillStyle = '#E0E0E0';
        ctx.font = `normal 26px ${fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.label, 100, y);

        // Bar Skor (Gaya Baru)
        const filledWidth = (item.value / 100) * barWidth;
        const barGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        barGradient.addColorStop(0, '#A052E8'); // Ungu
        barGradient.addColorStop(1, '#E8527A'); // Merah muda

        // Bagian yang terisi
        ctx.fillStyle = barGradient;
        ctx.fillRect(barX, y - barHeight / 2, filledWidth, barHeight);

        // Bagian yang kosong (lebih gelap)
        ctx.fillStyle = '#1F253D';
        ctx.fillRect(barX + filledWidth, y - barHeight / 2, barWidth - filledWidth, barHeight);
    });

    return canvas.toBuffer('image/jpeg');
}


// --- FUNGSI UTAMA COMMAND (TIDAK ADA PERUBAHAN LOGIKA, HANYA PEMANGGILAN) ---
export default async function facerating(sock, message, args, query, sender, extras) {
    const m = message;
    const jid = m.key.remoteJid;
    
    const media = await H.downloadMedia(m);

    if (!media) {
        return H.sendMessage(sock, jid, '❌ *Gambar tidak ditemukan!*\n\nKirim atau balas gambar dengan caption `!rate`', { quoted: m });
    }

    const { buffer, mimetype } = media;
    
    await H.react(sock, jid, m.key, '🧐');
    const sentMsg = await H.sendMessage(sock, jid, '🔬 Menganalisis wajah Anda dengan teknologi canggih...', { quoted: m });
    const messageKey = sentMsg.key;

    try {
        await H.editMessage(sock, jid, `📤 Mengunggah gambar Anda...`, messageKey);
        const userImageUrl = await H.uploadImage(buffer, mimetype);
        if (!userImageUrl) {
            throw new Error('Gagal mengunggah gambar Anda untuk diproses.');
        }
        
        const form = new FormData();
        form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype });

        await H.editMessage(sock, jid, `🤖 Mengirim gambar ke AI...`, messageKey);
        const { data: initialResponse } = await axios.post('https://szyrineapi.biz.id/api/img/pixnova/face-rating', form, {
            headers: form.getHeaders(),
        });

        if (initialResponse?.status !== 200 || !initialResponse.result?.statusUrl) {
            throw new Error(initialResponse.message || 'Gagal memulai proses di API.');
        }

        const { statusUrl } = initialResponse.result;
        
        await H.editMessage(sock, jid, `⏳ Menunggu hasil dari AI...`, messageKey);
        await H.pollPixnovaJob(statusUrl);

        const { data: finalResult } = await axios.get(statusUrl);
        if (finalResult.result?.status !== 'completed' || !finalResult.result.result) {
            throw new Error('API gagal memproses atau hasil tidak valid.');
        }

        await H.editMessage(sock, jid, `🎨 Menggambar hasil analisis...`, messageKey);
        const ratingImageBuffer = await createRatingImage(userImageUrl, finalResult.result.result);

        const caption = `*✨ Hasil Analisis Wajah ✨*\n\n` +
                        `*Skor Total:* ${finalResult.result.result.face_score}/100\n` +
                        `*Gender:* ${finalResult.result.result.gender}\n` +
                        `*Prediksi Umur:* ${finalResult.result.result.age} tahun\n\n` +
                        `_${config.WATERMARK}_\n\n` +
                        `*Catatan:* Hasil ini dihasilkan oleh AI dan hanya untuk hiburan. Setiap individu unik dan berharga dengan caranya sendiri. ❤️`;
        
        await H.sendImage(sock, jid, ratingImageBuffer, caption, false, { quoted: m });
        await H.editMessage(sock, jid, `✅ Analisis selesai!`, messageKey);

    } catch (error) {
        console.error("FaceRating Command Error:", error);
        const errorMessage = error.response?.data?.message || error.message || "Terjadi kesalahan yang tidak diketahui.";
        await H.editMessage(sock, jid, `❌ Gagal menganalisis: ${errorMessage}`, messageKey);
    }
}