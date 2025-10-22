// /modules/downloaders/pinterest.js (UNTUK PENCARIAN GAMBAR & VIDEO)

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, sendCarousel, delay } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mencari gambar atau video dari Pinterest.';
export const usage = `${config.BOT_PREFIX}pinterest <query> [--geser N]`;
export const aliases = [
  'pin', 'pinterestsearch', 'pinimg', 'pinterestimg',
  'pinvid', 'pinterestvid', 'pinterestvideo'
];

// --- KONFIGURASI & FUNGSI UTILITAS ---
const SZYRINE_PIN_SEARCH = 'https://szyrineapi.biz.id/api/downloaders/pinterest/search-v3';

/**
 * Mendeteksi command yang digunakan dari teks pesan.
 */
function parseUsedCommand(msgText) {
  const prefix = config.BOT_PREFIX || '!';
  if (!msgText?.startsWith(prefix)) return null;
  const first = msgText.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
  return first || null;
}

/**
 * Memisahkan query pencarian dan jumlah slide dari argumen.
 */
function parseArgsToQueryAndSlide(args, rawText) {
  const joined = (rawText || args.join(' ')).trim();
  const parts = joined.split('--geser');
  const query = parts[0].trim();
  let amount = 0;
  if (parts[1]) {
    const n = parseInt(parts[1].trim().split(/\s+/)[0] || '0', 10);
    amount = Math.max(1, Math.min(Number.isFinite(n) ? n : 0, 15));
  }
  return { query, amount };
}

// --- FUNGSI PENGAMBILAN DATA DARI API ---

/**
 * Mengambil data gambar dari Szyrine API untuk sendCarousel.
 */
async function fetchImageItemsFromSzyrine(q, limit = 10) {
    const apiParams = { 
        q,
        ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
    };
    const { data } = await axios.get(SZYRINE_PIN_SEARCH, { params: apiParams });
    const rows = (data?.result || []).slice(0, Math.max(1, Math.min(limit, 15)));
    return rows
        .map(x => x?.imageLink ? ({ 
            url: x.imageLink, 
            title: x.title || 'Pinterest Image',
            body: x.title || 'Gambar dari Pinterest'
        }) : null)
        .filter(Boolean);
}

/**
 * Mengambil daftar link video dari Szyrine API.
 */
async function fetchVideoListFromSzyrine(q, limit = 5) {
    const apiParams = { 
        q,
        ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
    };
    const { data } = await axios.get(SZYRINE_PIN_SEARCH, { params: apiParams });
    const rows = (data?.result || []).slice(0, Math.max(1, Math.min(limit, 10)));
    return rows.map((x, i) => `${i + 1}. ${x?.title || 'Pinterest Video'}\n${x?.pinterestLink || x?.imageLink || ''}`);
}


// --- EKSEKUSI COMMAND UTAMA ---
export default async function (sock, message, args, rawText, sender) {
  const jid = message.key.remoteJid;
  const fullText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

  const usedCommand = parseUsedCommand(fullText);
  const { query, amount } = parseArgsToQueryAndSlide(args, rawText);

  if (!query) {
    return sendMessage(sock, jid,
      `Silakan masukkan kata kunci pencarian.\n\n*Contoh:*\n` +
      `\`${config.BOT_PREFIX}pinterest angelina christy\`\n` +
      `\`${config.BOT_PREFIX}pinvid aesthetic scenery --geser 5\``,
      { quoted: message }
    );
  }

  try {
    // --- Mode Video ---
    if (/pinvid|pinterestvid|pinterestvideo/.test(usedCommand || '')) {
      const lines = await fetchVideoListFromSzyrine(query, amount || 5);
      if (!lines.length) {
        return sendMessage(sock, jid, `❌ Tidak ditemukan hasil video dari Pinterest untuk "${query}".`, { quoted: message });
      }
      const replyText = `🎬 *Hasil Video Pinterest untuk "${query}"*\n\n${lines.join('\n\n')}`;
      return sendMessage(sock, jid, replyText, { quoted: message });
    }

    // --- Mode Gambar (Default) ---
    const limit = amount || 10;
    const items = await fetchImageItemsFromSzyrine(query, limit);
    if (!items.length) {
      return sendMessage(sock, jid, `❌ Tidak ditemukan hasil gambar dari Pinterest untuk "${query}".`, { quoted: message });
    }

    await delay(200);

    await sendCarousel(sock, jid, items, {
        title: `🖼️ Hasil Pencarian Pinterest`,
        body: `Menampilkan ${items.length} gambar untuk "${query}"`,
        footer: config.WATERMARK || 'Bot WhatsApp'
    });

  } catch (err) {
    console.error('[PINTEREST_ERROR]', err);
    await sendMessage(sock, jid, `❌ Terjadi kesalahan saat mencari di Pinterest: ${err?.message || 'Error tidak diketahui'}`, { quoted: message });
  }
}