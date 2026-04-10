// libs/tiktok.js (SUPPORT ALL TYPE: SCRAPE + API BACKUP)

import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const USER_AGENTS = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
};

// =================================================================
// === BAGIAN 1: API BACKUP (SZYRINE API) ===
// =================================================================
async function getFromAPI(url) {
    try {
        const apiUrl = `https://szyrine.me/api/dl/tiktok?url=${encodeURIComponent(url)}`;
        const { data } = await axios.get(apiUrl, { timeout: 30000 });

        // Cek apakah response valid dari API
        if (data?.status !== 200 || !data?.result?.status) return null;

        const res = data.result;
        const title = res.title || "TikTok Downloader";

        // Kasus 1: Carousel / Kumpulan Gambar
        if (res.type === 'carousel' || (res.download?.images && res.download.images.length > 0)) {
            return {
                type: 'image',
                title,
                imageUrls: res.download.images
            };
        }

        // Kasus 2: Video (Atau gambar tunggal yang dilabeli 'video' oleh beberapa API)
        const vidUrl = res.download?.nowm || res.download?.wm;
        if (vidUrl) {
            // Deteksi jika ternyata ini adalah foto tunggal berformat jpeg/png
            if (/\.(jpeg|jpg|png)/i.test(vidUrl)) {
                return {
                    type: 'image',
                    title,
                    imageUrls: [vidUrl]
                };
            }
            return {
                type: 'video',
                title,
                videoUrl: vidUrl
            };
        }

        return null;
    } catch (error) {
        console.error("[TIKTOK_API] API Backup gagal:", error.message);
        return null;
    }
}

// =================================================================
// === BAGIAN 2: INTERNAL SCRAPER ===
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
        description: itemModule.desc || 'TikTok Media',
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

    const scripts = $('script');
    for (const el of scripts) {
      const scriptContent = $(el).html()?.trim();
      if (scriptContent?.startsWith('{') && scriptContent?.endsWith('}')) {
        try {
          const json = JSON.parse(scriptContent);
          const found = findKeyRecursive(json, 'itemStruct');
          if (found && found.id) {
            itemModule = found;
            break;
          }
        } catch (e) {}
      }
    }

    if (itemModule) {
      const parsedData = parseItemStruct(itemModule);
      return parsedData.type ? { ...parsedData, finalUrl } : null;
    }
    return null;
  } catch (error) {
    throw new Error(`Scrape HTTP Error: ${error.message}`);
  }
}

async function downloadMediaAsBuffer(client, url, referer, uaType = 'desktop') {
    const { data } = await client.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'Referer': referer,
            'Range': 'bytes=0-',
            'User-Agent': USER_AGENTS[uaType],
        },
        timeout: 60000,
    });
    return data;
}

// =================================================================
// === FUNGSI EKSPOR UTAMA ===
// =================================================================
export async function getTikTokPost(tiktokUrl) {
    console.log(`[TIKTOK] Mencoba internal scraper untuk: ${tiktokUrl}`);

    try {
        const jar = new CookieJar();
        const client = wrapper(axios.create({ jar }));

        // Coba pakai Mobile dulu
        let postData = await scrapePage(tiktokUrl, USER_AGENTS.mobile, client);

        // Jika gagal / hasilnya video, coba ulang pakai Desktop
        if (!postData || postData.type === 'video') {
            const desktopData = await scrapePage(tiktokUrl, USER_AGENTS.desktop, client);
            if (desktopData) postData = desktopData;
        }

        if (postData) {
            const { type, finalUrl } = postData;
            
            if (type === 'image') {
                const imageBuffers = [];
                for (const imageUrl of postData.images) {
                    const buffer = await downloadMediaAsBuffer(client, imageUrl, finalUrl, 'mobile');
                    imageBuffers.push(buffer);
                }
                return { type: 'image', title: postData.description, imageBuffers };

            } else if (type === 'video') {
                const videoBuffer = await downloadMediaAsBuffer(client, postData.videoUrl, finalUrl, 'desktop');
                return { type: 'video', title: postData.description, videoBuffer };
            }
        }
        throw new Error("Data itemStruct tidak ditemukan.");
    } catch (error) {
        console.warn(`[TIKTOK] Internal scraper gagal: ${error.message}. Beralih ke API Backup...`);
    }

    // --- FALLBACK KE API JIKA SCRAPE GAGAL ---
    console.log(`[TIKTOK] Menggunakan API Backup untuk: ${tiktokUrl}`);
    const apiResult = await getFromAPI(tiktokUrl);
    
    if (apiResult) {
        console.log(`[TIKTOK] Sukses mengambil dari API Backup (${apiResult.type}).`);
        return apiResult;
    }

    // Jika keduanya gagal
    throw new Error('Gagal mengunduh media dari sistem utama maupun backup API. Link mungkin private atau dihapus.');
}