// /libs/tiktok.js (FINAL VERSION - INTEGRATED WITH ADVANCED SCRAPER & AXIOS DOWNLOADER)

import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENTS = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
};

// =================================================================
// === BAGIAN SCRAPER (KODE BARU ANDA YANG SUDAH TERINTEGRASI) ===
// =================================================================

function findKeyRecursive(obj, key) {
  if (typeof obj !== 'object' || obj === null) return null;
  if (key in obj) return obj[key];
  for (const k in obj) {
    const found = findKeyRecursive(obj[k], key);
    if (found) return found;
  }
  return null;
}

function parseItemStruct(itemModule) {
    if (!itemModule || !itemModule.id) {
        console.error(`[PARSE ERROR] 'itemStruct' tidak valid.`);
        return { type: null };
    }
    const baseData = {
        id: itemModule.id,
        description: itemModule.desc,
        author: itemModule.author,
        music: itemModule.music,
        stats: itemModule.stats,
    };
    if (itemModule.imagePost?.images) {
        return { ...baseData, type: 'image', images: itemModule.imagePost.images.map(img => img.imageURL.urlList[0]) };
    } else if (itemModule.video) {
        return { ...baseData, type: 'video', videoUrl: itemModule.video.playAddr };
    }
    return { type: null };
}

async function scrapePage(url, userAgent) {
  try {
    const { data: html, request } = await axios.get(url, { headers: { 'User-Agent': userAgent } });
    const finalUrl = request.res.responseUrl || url;
    console.log(`[SCRAPE] Respons HTML diterima. URL Final: ${finalUrl}`);
    
    let itemModule = null;
    let methodUsed = '';
    const $ = cheerio.load(html);

    // Strategi 1: __UNIVERSAL_DATA_FOR_REHYDRATION__
    const scriptTag = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
    if (scriptTag.length > 0 && scriptTag.html()) {
      try {
        itemModule = findKeyRecursive(JSON.parse(scriptTag.html()), 'itemStruct');
        if (itemModule) methodUsed = 'UNIVERSAL_DATA';
      } catch (e) {}
    }

    // Strategi 2: Semua script tag
    if (!itemModule) {
      $('script').each((i, el) => {
        const scriptContent = $(el).html()?.trim();
        if (scriptContent?.startsWith('{') && scriptContent?.endsWith('}')) {
          try {
            const found = findKeyRecursive(JSON.parse(scriptContent), 'itemStruct');
            if (found) {
              itemModule = found;
              methodUsed = 'JSON_SCAN';
              return false;
            }
          } catch (e) {}
        }
      });
    }

    if (itemModule) {
      console.log(`[SCRAPE] Data 'itemStruct' ditemukan via metode: ${methodUsed}`);
      const parsedData = parseItemStruct(itemModule);
      return parsedData.type ? { ...parsedData, finalUrl } : null;
    }
    
    console.warn(`[SCRAPE] Gagal menemukan 'itemStruct' pada halaman.`);
    return null;
  } catch (error) {
    console.error(`[SCRAPE] Error saat scraping: ${error.message}`);
    return null;
  }
}

// =================================================================
// === BAGIAN DOWNLOADER (BARU, DENGAN AXIOS & HEADER KHUSUS) ===
// =================================================================

/**
 * Mengunduh media dari URL sebagai Buffer.
 * @param {string} url URL media
 * @param {string} referer URL halaman TikTok asal
 * @param {'desktop'|'mobile'} uaType Tipe User-Agent yang akan digunakan
 * @returns {Promise<Buffer>}
 */
export async function downloadMediaAsBuffer(url, referer, uaType = 'desktop') {
    console.log(`[DOWNLOAD] Memulai unduhan untuk: ${url.slice(0, 60)}...`);
    try {
        const { data } = await axios.get(url, {
            responseType: 'arraybuffer', // Ini kunci utamanya
            headers: {
                'Referer': referer,
                'Range': 'bytes=0-', // Header penting untuk video
                'User-Agent': USER_AGENTS[uaType],
            },
            timeout: 180000, // Timeout 3 menit
        });
        console.log(`[DOWNLOAD] Sukses. Ukuran buffer: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
        return data;
    } catch (error) {
        console.error(`[DOWNLOAD] Gagal mengunduh dari ${url}: ${error.message}`);
        throw new Error('Gagal mengunduh media dari server TikTok.');
    }
}


// =================================================================
// === FUNGSI EKSPOR UTAMA (MENGGABUNGKAN SEMUANYA) ===
// =================================================================

/**
 * Fungsi utama yang dipanggil oleh command.
 * @param {string} tiktokUrl URL postingan TikTok.
 * @returns {Promise<object|null>}
 */
export async function getTikTokPost(tiktokUrl) {
  console.log(`[MAIN] Memulai proses untuk: ${tiktokUrl}`);

  // Langkah 1: Deteksi tipe postingan dengan HEAD request (opsional tapi bagus)
  // Untuk sementara, kita langsung coba scrape
  
  // Langkah 2: Lakukan scraping awal untuk mendapatkan data dasar.
  // Kita coba dengan mobile dulu, karena seringkali lebih informatif
  let initialData = await scrapePage(tiktokUrl, USER_AGENTS.mobile);
  
  // Jika gagal dengan mobile atau hasilnya video, coba lagi dengan desktop untuk memastikan
  if (!initialData || initialData.type === 'video') {
      console.log("[MAIN] Hasil awal adalah video atau gagal, mencoba ulang dengan UA Desktop untuk data terbaik.");
      const desktopData = await scrapePage(tiktokUrl, USER_AGENTS.desktop);
      // Prioritaskan data dari desktop jika tersedia, terutama untuk video
      if (desktopData) initialData = desktopData;
  }

  if (!initialData) {
      console.error("[MAIN] Gagal total mendapatkan data setelah semua upaya scraping.");
      return null;
  }
  
  const { type, finalUrl } = initialData;

  // Langkah 3: Berdasarkan tipe, gunakan User-Agent yang TEPAT untuk download
  if (type === 'image') {
    console.log(`[MAIN] Tipe: FOTO. Mengunduh ${initialData.images.length} gambar dengan UA Mobile.`);
    const imageBuffers = [];
    for (const imageUrl of initialData.images) {
      const buffer = await downloadMediaAsBuffer(imageUrl, finalUrl, 'mobile'); // WAJIB MOBILE
      imageBuffers.push(buffer);
    }
    return { ...initialData, imageBuffers };

  } else if (type === 'video') {
    console.log(`[MAIN] Tipe: VIDEO. Mengunduh video dengan UA Desktop.`);
    const videoBuffer = await downloadMediaAsBuffer(initialData.videoUrl, finalUrl, 'desktop'); // WAJIB DESKTOP
    return { ...initialData, videoBuffer };

  }
  
  return null;
}