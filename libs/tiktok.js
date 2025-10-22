// /libs/tiktok.js (FINAL & REINFORCED - WITH COOKIE JAR & BROWSER HEADERS)

import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const USER_AGENTS = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
};

// =================================================================
// === BAGIAN SCRAPER (TIDAK BERUBAH BANYAKKK) ===
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
    if (!itemModule || !itemModule.id) return { type: null };
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

async function scrapePage(url, userAgent, client) {
  try {
    const { data: html, request } = await client.get(url, { headers: { 'User-Agent': userAgent } });
    const finalUrl = request.res.responseUrl || url;
    const $ = cheerio.load(html);
    let itemModule = null;
    let methodUsed = '';

    // Cari dengan berbagai metode
    const scripts = $('script');
    for (const el of scripts) {
      const scriptContent = $(el).html()?.trim();
      if (scriptContent?.startsWith('{') && scriptContent?.endsWith('}')) {
        try {
          const json = JSON.parse(scriptContent);
          const found = findKeyRecursive(json, 'itemStruct');
          if (found && found.id) {
            itemModule = found;
            methodUsed = $(el).attr('id') || 'JSON_SCAN';
            break;
          }
        } catch (e) {}
      }
    }

    if (itemModule) {
      console.log(`[SCRAPE] Data 'itemStruct' ditemukan via: ${methodUsed}`);
      const parsedData = parseItemStruct(itemModule);
      return parsedData.type ? { ...parsedData, finalUrl } : null;
    }
    
    return null;
  } catch (error) {
    console.error(`[SCRAPE] Error saat scraping: ${error.message}`);
    return null;
  }
}

// =================================================================
// === BAGIAN DOWNLOADER (INI YANG KITA ROMBAK TOTAL) ===
// =================================================================

/**
 * Mengunduh media dari URL sebagai Buffer, kini dengan cookie dan header lengkap.
 * @param {import('axios').AxiosInstance} client Instance axios yang sudah terbungkus cookie jar.
 */
export async function downloadMediaAsBuffer(client, url, referer, uaType = 'desktop') {
    console.log(`[DOWNLOAD] Memulai unduhan untuk: ${url.slice(0, 60)}...`);
    try {
        const { data } = await client.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'Referer': referer,
                'Range': 'bytes=0-',
                'User-Agent': USER_AGENTS[uaType],
                'accept': '*/*',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-dest': 'video',
                'sec-fetch-mode': 'no-cors',
                'sec-fetch-site': 'same-site',
            },
            timeout: 180000,
        });
        console.log(`[DOWNLOAD] Sukses. Ukuran buffer: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
        return data;
    } catch (error) {
        const status = error.response?.status || 'N/A';
        console.error(`[DOWNLOAD] Gagal mengunduh (Status: ${status}): ${error.message}`);
        throw new Error(`Gagal mengunduh media dari server TikTok. Status: ${status}`);
    }
}

// =================================================================
// === FUNGSI EKSPOR UTAMA (DENGAN MANAJEMEN SESI COOKIE) ===
// =================================================================

export async function getTikTokPost(tiktokUrl) {
  console.log(`[MAIN] Memulai sesi scraping baru untuk: ${tiktokUrl}`);

  // 1. Buat "sesi browsing" baru dengan cookie jar-nya sendiri
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));

  // 2. Kunjungi halaman dengan UA Mobile dulu untuk mengambil cookie
  let postData = await scrapePage(tiktokUrl, USER_AGENTS.mobile, client);

  // Jika gagal atau hasilnya video, coba lagi dengan UA Desktop
  if (!postData || postData.type === 'video') {
      const desktopData = await scrapePage(tiktokUrl, USER_AGENTS.desktop, client);
      if (desktopData) postData = desktopData;
  }

  if (!postData) {
      throw new Error('Gagal mengekstrak data media dari halaman TikTok.');
  }
  
  const { type, finalUrl } = postData;

  // 3. Gunakan sesi (client) yang sama untuk mengunduh, plus strategi UA
  if (type === 'image') {
    console.log(`[MAIN] Tipe: FOTO. Mengunduh ${postData.images.length} gambar dengan UA Mobile.`);
    const imageBuffers = [];
    for (const imageUrl of postData.images) {
      const buffer = await downloadMediaAsBuffer(client, imageUrl, finalUrl, 'mobile');
      imageBuffers.push(buffer);
    }
    return { ...postData, imageBuffers };

  } else if (type === 'video') {
    console.log(`[MAIN] Tipe: VIDEO. Mengunduh video dengan UA Desktop.`);
    const videoBuffer = await downloadMediaAsBuffer(client, postData.videoUrl, finalUrl, 'desktop');
    return { ...postData, videoBuffer };
  }
  
  return null;
}