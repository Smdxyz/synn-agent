// modules/images/upscale.js
import axios from 'axios';
import FormData from 'form-data';
import sharp from 'sharp';
import H from '../../helper.js';
import { config } from '../../config.js';

export const category = 'Images';
export const description = 'Upscale gambar ke HD + Smart Optimizer (Auto-Detect Anime/Real/Night).';
export const usage = `${config.BOT_PREFIX}upscale`;
export const aliases = ['hd', 'remini-hd', 'sw-hd'];

export default async function upscale(sock, message, args, query, sender, extras) {
  const m = message;
  const jid = m.key.remoteJid;

  // 1. Download Media
  const media = await H.downloadMedia(m);
  if (!media) {
    return H.sendMessage(
      sock,
      jid,
      '❌ *Gambar tidak ditemukan!*\n\nKirim atau balas gambar dengan caption `!upscale`',
      { quoted: m }
    );
  }

  const { buffer, mimetype } = media;

  // 2. Notifikasi Awal
  await H.react(sock, jid, m.key, '📸');
  const sentMsg = await H.sendMessage(sock, jid, '⏳ *Analyzing & Upscaling...*', { quoted: m });
  const messageKey = sentMsg.key;

  try {
    // --------------------------------------------------------------------------------
    // TAHAP 1: UPLOAD KE API AI (Resolution Boost)
    // --------------------------------------------------------------------------------
    await H.editMessage(sock, jid, '🚀 Boosting Resolution (AI)...', messageKey);
    
    const form = new FormData();
    form.append('image', buffer, { filename: 'image.jpg', contentType: mimetype || 'image/jpeg' });

    // API Upscaler (Base Resolution Booster)
    const response = await axios.post(
      'https://szyrineapi.biz.id/api/img/upscale/imgupscaler',
      form,
      { headers: form.getHeaders() }
    );

    const result = response.data.result;
    if (response.data.status !== 200 || !result?.success || !result?.result_url) {
      throw new Error(result?.message || 'Gagal respon dari API Upscale.');
    }

    // Download hasil mentah dari API
    const resImg = await axios.get(result.result_url, { responseType: 'arraybuffer' });
    let imageBuffer = Buffer.from(resImg.data);

    // --------------------------------------------------------------------------------
    // TAHAP 2: SMART PROCESSING (Adaptive Logic)
    // --------------------------------------------------------------------------------
    await H.editMessage(sock, jid, '🎨 Applying Smart Filters...', messageKey);

    const pipeline = sharp(imageBuffer);
    const metadata = await pipeline.metadata();
    const stats = await pipeline.stats(); // Analisis histogram warna

    // -- A. Analisis Data Gambar --
    // Hitung rata-rata kecerahan (0-255)
    const brightness = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
    // Hitung variasi pixel (Standard Deviation) -> Menentukan tekstur
    const deviation = (stats.channels[0].stdev + stats.channels[1].stdev + stats.channels[2].stdev) / 3;

    let sharpParams = {};
    let saturationBoost = 1.0;
    let modeName = '';

    // -- B. Tentukan Mode Otomatis (Revisi V3 Logic) --
    
    // KASUS 1: LOW LIGHT / MALAM (Brightness rendah)
    if (brightness < 60) {
        modeName = 'Night Mode 🌙';
        // Sharpening halus, fokus kurangi noise background
        sharpParams = { sigma: 1.0, m1: 1.0, m2: 2.0, x1: 2, y2: 10, y3: 15 };
        saturationBoost = 1.1; // Sedikit boost warna biar gak kusam
    } 
    // KASUS 2: ANIME / VEKTOR FLAT (Deviasi < 50)
    // Angka 50 dipilih supaya foto manusia (yang deviasinya 60-70an) gak nyasar kesini
    else if (deviation < 50) {
        modeName = 'Anime/Vector Mode ⛩️';
        // Sharpening agresif buat garis tegas
        sharpParams = { sigma: 1.4, m1: 0.3, y2: 18, x1: 1.0 };
        saturationBoost = 1.15; // Anime lebih hidup dengan warna vibrant
    } 
    // KASUS 3: FOTO REAL / MANUSIA / PEMANDANGAN (Default)
    else {
        modeName = 'Realistic Mode 📷';
        // REVISI SOFT: Sharpening sangat tipis agar kulit tidak kasar/gosong
        sharpParams = { sigma: 0.6, m1: 0.0, m2: 1.5, x1: 2.5, y2: 8, y3: 8 };
        saturationBoost = 1.0; // Natural (tidak ada boost warna)
    }

    console.log(`[Upscale] Stats: Brightness=${brightness.toFixed(0)}, Dev=${deviation.toFixed(0)} | Mode: ${modeName}`);

    // -- C. Eksekusi Pipeline Akhir --
    imageBuffer = await pipeline
        // 1. Resize Cerdas (Downscaling aman buat WA)
        .resize({
            width: metadata.width > metadata.height ? 1920 : 1080, // Landscape 1920, Portrait 1080
            height: metadata.width > metadata.height ? 1080 : 1920,
            fit: 'inside', // Jaga aspek rasio
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3 // Algoritma resize paling detail
        })
        // 2. Atur Warna (Saturasi)
        .modulate({
            saturation: saturationBoost
        })
        // 3. Terapkan Sharpening sesuai Mode
        .sharpen(sharpParams)
        // 4. Final Output dengan MozJPEG (High Quality Compression)
        .withMetadata({ density: 300 }) 
        .jpeg({
            quality: 92, // Kualitas 92% (Sweet spot size vs quality)
            chromaSubsampling: '4:4:4', // WAJIB: Warna merah/biru tidak pecah
            mozjpeg: true,
            force: true
        })
        .toBuffer();

    // --------------------------------------------------------------------------------
    // TAHAP 3: KIRIM HASIL
    // --------------------------------------------------------------------------------
    const caption = `*✨ HD Result (Auto-Tuned) ✨*\n\n` +
                    `🧩 *Mode:* ${modeName}\n` +
                    `📊 *Res:* ${metadata.width}x${metadata.height} ➝ Optimized HD\n` +
                    `🛡️ *Anti-Blur:* Active (MozJPEG)\n\n` +
                    `*${config.WATERMARK}*`;

    await H.sendImage(sock, jid, imageBuffer, caption, false, { quoted: m });
    
    await H.editMessage(sock, jid, '✅ Done!', messageKey);

  } catch (error) {
    console.error('Upscale Error:', error);
    await H.editMessage(sock, jid, `❌ Gagal: ${error.message}`, messageKey);
  }
}

export const cost = 10;
