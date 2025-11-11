// modules/fun/facerating.js (FIXED - Handles user image URL for canvas)

import axios from 'axios';
import FormData from 'form-data';
import H from '../../helper.js';
import { config } from '../../config.js';
import { createCanvas, loadImage, registerFont } from 'canvas';

// --- METADATA COMMAND ---
export const category = 'Fun';
export const description = 'Memberi rating pada wajah di gambar menggunakan AI.';
export const usage = `${config.BOT_PREFIX}rate`;
export const aliases = ['facerate', 'rateface', 'howhot'];

// --- FUNGSI PEMBUAT GAMBAR DENGAN CANVAS ---
async function createRatingImage(userImageUrl, data) { // <-- Menerima URL gambar pengguna
    try {
        registerFont('../../assets/fonts/Poppins-Bold.ttf', { family: 'Poppins', weight: 'bold' });
        registerFont('../../assets/fonts/Poppins-Regular.ttf', { family: 'Poppins', weight: 'normal' });
    } catch (e) {
        console.warn("[FaceRating] Font kustom tidak ditemukan, menggunakan font default.");
    }
    
    const fontFamily = 'Poppins, sans-serif';
    const width = 800;
    const height = 1000;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, width, height);
    
    const mainPadding = 50;
    ctx.fillStyle = '#16213E';
    ctx.beginPath();
    ctx.moveTo(mainPadding + 20, mainPadding);
    ctx.lineTo(width - mainPadding - 20, mainPadding);
    ctx.quadraticCurveTo(width - mainPadding, mainPadding, width - mainPadding, mainPadding + 20);
    ctx.lineTo(width - mainPadding, height - mainPadding - 20);
    ctx.quadraticCurveTo(width - mainPadding, height - mainPadding, width - mainPadding - 20, height - mainPadding);
    ctx.lineTo(mainPadding + 20, height - mainPadding);
    ctx.quadraticCurveTo(mainPadding, height - mainPadding, mainPadding, height - mainPadding - 20);
    ctx.lineTo(mainPadding, mainPadding + 20);
    ctx.quadraticCurveTo(mainPadding, mainPadding, mainPadding + 20, mainPadding);
    ctx.closePath();
    ctx.fill();

    // --- Gambar Profil ---
    // Di sinilah URL gambar pengguna digunakan
    try {
        const avatar = await loadImage(userImageUrl);
        const avatarX = 85;
        const avatarY = 100;
        const avatarSize = 250;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    } catch (e) {
        console.error("Gagal memuat gambar profil untuk canvas:", e);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `20px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText('Gagal memuat gambar', 85 + 250 / 2, 100 + 250 / 2);
    }
    
    // ... sisa kode canvas tetap sama ...
    const scoreX = 85 + 250 / 2;
    const scoreY = 100 + 250 / 2;
    const radius = 110;
    
    ctx.beginPath();
    ctx.arc(scoreX, scoreY, radius, 0, Math.PI * 2);
    ctx.lineWidth = 20;
    ctx.strokeStyle = '#0F3460';
    ctx.stroke();
    
    const gradient = ctx.createLinearGradient(scoreX - radius, scoreY - radius, scoreX + radius, scoreY + radius);
    gradient.addColorStop(0, '#533483');
    gradient.addColorStop(1, '#E94560');
    
    const endAngle = (data.face_score / 100) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(scoreX, scoreY, radius, -Math.PI / 2, endAngle);
    ctx.strokeStyle = gradient;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 70px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.face_score, scoreX, scoreY);
    
    ctx.strokeStyle = '#3D52A0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(85, 400);
    ctx.lineTo(width - 85, 400);
    ctx.stroke();

    const startY = 460;
    const lineHeight = 75;
    const barWidth = 400;
    
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
        ctx.fillStyle = '#E0E0E0';
        ctx.font = `normal 28px ${fontFamily}`;
        ctx.textAlign = 'left';
        ctx.fillText(item.label, 100, y);
        ctx.fillStyle = '#0F3460';
        ctx.fillRect(width - barWidth - 100, y - 10, barWidth, 15);
        const barGradient = ctx.createLinearGradient(width - barWidth - 100, 0, width - 100, 0);
        barGradient.addColorStop(0, '#533483');
        barGradient.addColorStop(1, '#E94560');
        ctx.fillStyle = barGradient;
        ctx.fillRect(width - barWidth - 100, y - 10, (item.value / 100) * barWidth, 15);
    });
    
    ctx.fillStyle = '#E0E0E0';
    ctx.font = `normal 32px ${fontFamily}`;
    ctx.textAlign = 'right';
    ctx.fillText(`Predicted Age: ${data.age} | Gender: ${data.gender.charAt(0).toUpperCase() + data.gender.slice(1)}`, width - 100, 150);

    return canvas.toBuffer('image/jpeg');
}

// --- FUNGSI UTAMA COMMAND ---
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
        // --- LANGKAH YANG HILANG SEBELUMNYA ---
        // Unggah gambar pengguna untuk mendapatkan URL yang bisa diakses canvas
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
        // Kita tidak lagi butuh resultImageUrl dari poll, karena Szyrine tidak mengembalikannya untuk face-rating
        await H.pollPixnovaJob(statusUrl);

        const { data: finalResult } = await axios.get(statusUrl);
        if (finalResult.result?.status !== 'completed' || !finalResult.result.result) {
            throw new Error('API gagal memproses atau hasil tidak valid.');
        }

        await H.editMessage(sock, jid, `🎨 Menggambar hasil analisis...`, messageKey);
        // Gunakan URL gambar pengguna yang sudah kita unggah tadi
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