// helper.js — FINAL VERSION BASED ON ITSUKICHAN'S LOGIC

import got from 'got';
import { downloadContentFromMessage, generateWAMessageFromContent } from '@whiskeysockets/baileys'; // IMPORT generateWAMessageFromContent
import { config } from './config.js';
import FormData from 'form-data';
import axios from 'axios';
import baileysHelpers from 'baileys_helpers';

// ============================ UTILITAS DASAR =================================
export const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));
export const sleep = delay;
export const tryDo = async (fn, fallback = null) => { try { return await fn(); } catch { return fallback; } };
export const chunk = (arr, size = 10) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; };
const streamToBuffer = async (stream) => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); };


// ============================ PENGIRIM PESAN DASAR ============================
// ... (SEMUA FUNGSI DARI sendMessage HINGGA sendLocation TETAP SAMA, TIDAK PERLU DIUBAH)
export const sendMessage = async (sock, jid, text, options = {}) => sock.sendMessage(jid, { text }, options);
export { sendMessage as sendText };
export const sendImage = async (sock, jid, urlOrBuffer, caption = '', viewOnce = false, options = {}) => {
  const image = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { image, caption, viewOnce }, options);
};
export const sendAudio = async (sock, jid, urlOrBuffer, options = {}) => {
  const audio = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { audio, mimetype: options.mimetype || 'audio/mpeg', ptt: !!options.ptt }, options);
};
export const sendVideo = async (sock, jid, urlOrBuffer, caption = '', options = {}) => {
  const video = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { video, caption, mimetype: options.mimetype || 'video/mp4' }, options);
};
export const sendGif = async (sock, jid, urlOrBuffer, caption = '', options = {}) => {
  const video = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { video, caption, gifPlayback: true }, options);
};
export const sendDoc = async (sock, jid, urlOrBuffer, fileName = 'file', mimetype = 'application/pdf', options = {}) => {
  const document = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { document, fileName, mimetype }, options);
};
export const sendAlbum = async (sock, jid, albumPayload = [], options = {}) => {
    if (!Array.isArray(albumPayload) || albumPayload.length === 0) throw new Error("Payload untuk album tidak boleh kosong.");
    return sock.sendMessage(jid, { album: albumPayload }, options);
};
export const sendPoll = async (sock, jid, name, values, options = {}) => {
  return sock.sendMessage(jid, { poll: { name, values, selectableCount: 1 } }, options);
};
export const sendContact = async (sock, jid, fullName, org, waid, options = {}) => {
    const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + `FN:${fullName}\n` + `ORG:${org}\n` + `TEL;type=CELL;type=VOICE;waid=${waid}:+${waid}\n` + 'END:VCARD';
    return sock.sendMessage(jid, { contacts: { displayName: fullName, contacts: [{ vcard }] } }, options);
};
export const sendLocation = async (sock, jid, latitude, longitude, options = {}) => {
    return sock.sendMessage(jid, { location: { degreesLatitude: latitude, degreesLongitude: longitude } }, options);
};


// ============================ PENGIRIM PESAN INTERAKTIF (DITULIS ULANG BERDASARKAN LOGIKA ITSUKICHAN) ============================

/**
 * Mengirim pesan Carousel dengan meniru 100% logika itsukichan.
 * Mengatasi "Invalid media type" dengan memproses media sebelum mengirim.
 * @param {object} sock Socket Baileys
 * @param {string} jid JID Tujuan
 * @param {Array<object>} cards Kartu. Format: { image: <Buffer|{url}>, video: <Buffer|{url}>, body, footer, buttons: [...] }
 * @param {object} options Opsi tambahan
 */
export const sendCarousel = async (sock, jid, cards = [], options = {}) => {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error('Payload `cards` tidak boleh kosong.');
  }

  // Logika dari itsukichan: proses setiap kartu secara asinkron
  const processedCards = await Promise.all(cards.map(async (card) => {
    const { image, video, body, footer, buttons } = card;
    let mediaMessage;
    let preparedMedia;

    // Siapkan media (gambar atau video)
    if (image) {
      preparedMedia = { image };
    } else if (video) {
      preparedMedia = { video };
    } else {
      throw new Error('Setiap kartu harus memiliki `image` atau `video`.');
    }

    // Ini adalah langkah KUNCI dari itsukichan: proses media menggunakan fungsi internal Baileys
    mediaMessage = await generateWAMessageFromContent(
      jid,
      preparedMedia,
      { upload: sock.waUploadToServer } // Ini akan mengunduh, mengenkripsi, dan mengunggah media
    );
    
    // Siapkan tombol untuk nativeFlowMessage
    const nativeFlowButtons = (buttons || []).map(btn => ({
        name: 'quick_reply', // Asumsikan semua tombol adalah quick_reply untuk carousel
        buttonParamsJson: JSON.stringify({
            display_text: btn.displayText,
            id: btn.id || btn.buttonId
        })
    }));

    // Bentuk struktur satu kartu yang sudah diproses
    const singleCard = {
      header: {
        // Ambil hasil pemrosesan media (imageMessage atau videoMessage)
        ...(mediaMessage.message.imageMessage && { imageMessage: mediaMessage.message.imageMessage }),
        ...(mediaMessage.message.videoMessage && { videoMessage: mediaMessage.message.videoMessage }),
        hasMediaAttachment: true,
      },
      body: { text: body || '' },
      footer: { text: footer || '' },
      nativeFlowMessage: {
        buttons: nativeFlowButtons,
        messageParamsJson: ''
      }
    };
    return singleCard;
  }));

  // Susun pesan interaktif utama
  const interactiveMessage = {
    body: { text: options.text || '' },
    footer: { text: options.footer || '' },
    header: {
      title: options.title || '',
      hasMediaAttachment: false
    },
    carouselMessage: {
      cards: processedCards,
      messageVersion: 1
    }
  };

  // Bungkus dalam viewOnceMessage (sesuai praktik itsukichan/Baileys untuk pesan kompleks)
  const finalMessage = {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2
        },
        interactiveMessage: interactiveMessage
      }
    }
  };
  
  return sock.sendMessage(jid, finalMessage, options);
};

// --- FUNGSI INTERAKTIF LAINNYA (TETAP SAMA SEPERTI SEBELUMNYA) ---
export const sendList = async (sock, jid, title, text, buttonText, sections = [], options = {}) => {
  const listMessage = { text, footer: options.footer || '', title, buttonText, sections };
  return sock.sendMessage(jid, listMessage, options);
};
export const sendButtons = async (sock, jid, text, footer, buttons = [], options = {}) => {
  const payload = { text, footer, buttons };
  return baileysHelpers.sendButtons(sock, jid, payload, options);
};
export const sendInteractiveMessage = baileysHelpers.sendInteractiveMessage;


// ============================ AKSI PESAN & STATUS ============================
// ... (SEMUA FUNGSI DARI react HINGGA pollPixnovaJob TETAP SAMA)
export const react = async (sock, jid, key, emoji = '✅') => {
  try { return await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch { }
};
export const editMessage = async (sock, jid, newText, messageKey) => sock.sendMessage(jid, { text: newText, edit: messageKey });
export const deleteMessage = async (sock, jid, messageKey) => sock.sendMessage(jid, { delete: messageKey });
export const forwardMessage = async (sock, jid, message, options = {}) => sock.sendMessage(jid, { forward: message }, options);
export const setPresence = async (sock, jid, state = 'composing') => {
  try { await sock.sendPresenceUpdate(state, jid); } catch { }
};
export const typing = async (sock, jid, seconds = 1.25) => {
  await setPresence(sock, jid, 'composing'); await delay(seconds * 1000); await setPresence(sock, jid, 'paused');
};
export const fetchAsBufferWithMime = async (url) => {
  try {
    const response = await got(url, {
        responseType: 'buffer',
        headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7', 'Accept-Encoding': 'gzip, deflate, br', 'Accept-Language': 'en-US,en;q=0.9,id-ID;q=0.8,id;q=0.7', 'Connection': 'keep-alive', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1', 'Upgrade-Insecure-Requests': '1', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36', },
        http2: true, timeout: { request: 30000 }, retry: { limit: 2 }
    });
    const mimetype = response.headers['content-type'] || '';
    return { buffer: response.body, mimetype };
  } catch (error) {
    const status = error.response?.statusCode || 'Tidak diketahui';
    console.error(`Gagal fetch URL: ${url}`, `Server merespon dengan status: ${status}`);
    throw new Error(`Gagal mengunduh konten. Server tujuan menolak dengan status: ${status}`);
  }
};
export const downloadMedia = async (message) => {
    let mediaMessage = message.message?.imageMessage || message.message?.videoMessage || message.message?.stickerMessage;
    if (!mediaMessage) {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) mediaMessage = quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage;
    }
    if (!mediaMessage) return null;
    try {
        const mimetype = mediaMessage.mimetype;
        const stream = await downloadContentFromMessage(mediaMessage, mediaMessage.videoMessage ? 'video' : (mediaMessage.stickerMessage ? 'sticker' : 'image'));
        const buffer = await streamToBuffer(stream);
        return { buffer, mimetype };
    } catch (e) {
        console.error("Gagal mengunduh media:", e); return null;
    }
};
export const uploadImage = async (buffer, mimetype = 'image/jpeg') => { 
    const form = new FormData();
    form.append('file', buffer, { filename: 'image.jpg', contentType: mimetype }); 
    const uploadUrl = `https://szyrineapi.biz.id/api/utility/upload`;
    const { data } = await axios.post(uploadUrl, form, { headers: form.getHeaders() });
    if (data.result?.file?.url) { return data.result.file.url; }
    else { throw new Error(data.result?.message || 'Gagal mengunggah gambar atau mendapatkan URL.'); }
};
export const pollPixnovaJob = async (statusUrl) => {
    for (let i = 0; i < 20; i++) {
        await delay(3000);
        try {
            const data = await got(statusUrl).json();
            if (data.result?.status === 'completed') return data.result.result.imageUrl || data.result.result.url || data.result.result_url;
            if (data.result?.status === 'failed' || data.result?.status === 'error') throw new Error(`Proses job gagal: ${data.result.message || 'Alasan tidak diketahui'}`);
        } catch (e) {}
    }
    throw new Error('Waktu pemrosesan habis (timeout).');
};

// ============================ EXPORT DEFAULT =================================
export default {
  delay, sleep, tryDo, chunk,
  sendMessage, sendText: sendMessage,
  sendImage, sendAudio, sendVideo, sendGif, sendDoc,
  sendAlbum, sendPoll, sendContact, sendLocation,
  sendCarousel, sendList, sendButtons, sendInteractiveMessage,
  react, editMessage, deleteMessage, forwardMessage,
  setPresence, typing,
  fetchAsBufferWithMime, downloadMedia, uploadImage, pollPixnovaJob,
};