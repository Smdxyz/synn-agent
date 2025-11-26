// modules/images/upscale.js
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import H from '../../helper.js';
import { config } from '../../config.js';

export const category = 'Images';
export const description = 'Upscale gambar ke HD + Optimalisasi khusus WhatsApp Story/Chat (Anti Pecah).';
export const usage = `${config.BOT_PREFIX}upscale`;
export const aliases = ['hd', 'remini-hd', 'sw-hd'];

export default async function upscale(sock, message, args, query, sender, extras) {
  const m = message;
  const jid = m.key.remoteJid;

  const media = await H.downloadMedia(m);
  if (!media) {
    return H.sendMessage(
      sock,
      jid,
      '❌ *Gambar tidak ditemukan!*\n\nKirim/balas gambar dengan caption `!upscale`',
      { quoted: m }
    );
  }

  const { buffer, mimetype } = media;

  await H.react(sock, jid, m.key, '📸');
  const sentMsg = await H.sendMessage(sock, jid, '⏳ Proses Upscale & Tuning...', { quoted: m });
  const messageKey = sentMsg.key;

  try {
    // 1. UPLOAD KE API UPSCALE (Biar resolusi naik dulu & noise hilang)
    await H.editMessage(sock, jid, '🚀 Boosting Resolution...', messageKey);
    
    const form = new FormData();
    form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype || 'image/jpeg' });

    const response = await axios.post(
      'https://szyrineapi.biz.id/api/img/upscale/imgupscaler',
      form,
      { headers: form.getHeaders() }
    );

    const result = response.data.result;
    if (response.data.status !== 200 || !result?.success || !result?.result_url) {
      throw new Error(result?.message || 'Gagal upscale gambar.');
    }

    // 2. DOWNLOAD HASIL UPSCALE
    await H.editMessage(sock, jid, '💎 Mengoptimalkan Pixel (Sharp)...', messageKey);
    const resImg = await axios.get(result.result_url, { responseType: 'arraybuffer' });
    let imageBuffer = Buffer.from(resImg.data);

    // 3. MAGIC SHARP (Optimizer Anti-Burik WA)
    // Kita buat dua layer proses: Resize Cerdas + Color Retention
    
    const pipeline = sharp(imageBuffer);
    const metadata = await pipeline.metadata();

    // Logika Resize:
    // WA Story mentok di lebar 1080px atau tinggi 1920px.
    // Jangan kasih file 4K ke WA, nanti dihancurin algoritmanya.
    // Kita resize manual pake Lanczos3 (Super Tajam) ke batas aman WA.
    
    imageBuffer = await pipeline
        .resize({
            width: metadata.width > metadata.height ? 1920 : 1080, // Landscape: 1920w, Portrait: 1080w
            height: metadata.width > metadata.height ? 1080 : 1920, // Ikuti rasio HP
            fit: 'inside', // Pastikan gambar masuk frame tanpa kepotong
            withoutEnlargement: true, // Kalau gambar aslinya kecil, jangan dipaksa
            kernel: sharp.kernel.lanczos3 // Algoritma resize terbaik
        })
        // RAHASIA SW TAJAM: Tambahin Sharpening (Unsharp Mask)
        // Sigma 1.0 - 1.5 bikin gambar agak "kasar" di PC, tapi pas masuk WA jadi TAJAM & JERNIH.
        .sharpen({
            sigma: 1.2, 
            m1: 0.5,
            y2: 15,
            x1: 1.5
        })
        // Metadata DPI (Beberapa HP baca ini buat rendering)
        .withMetadata({ density: 300 }) 
        .jpeg({
            quality: 92, // 92% is sweet spot. 100% file kegedean, WA bakal curiga & kompres ulang.
            chromaSubsampling: '4:4:4', // WAJIB: Biar warna merah/biru gak pecah
            mozjpeg: true, // Kompresi pintar
            force: true
        })
        .toBuffer();

    // 4. KIRIM
    await H.sendImage(sock, jid, imageBuffer, `*✨ HD Mode (Status Optimized) ✨*\n\nResolusi disesuaikan agar tidak pecah saat dijadikan SW/Story.\n\n*${config.WATERMARK}*`, false, { quoted: m });
    
    await H.editMessage(sock, jid, '✅ Done! Siap post SW.', messageKey);

  } catch (error) {
    console.error('Upscale Error:', error);
    await H.editMessage(sock, jid, `❌ Gagal: ${error.message}`, messageKey);
  }
}