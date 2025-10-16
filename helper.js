// helper.js — ESM — (VERSI DEFINITIF & STABIL)
// Mencakup semua fitur pengiriman pesan yang dibutuhkan dan perbaikan bug.
// Fitur generate thumbnail video telah DIMATIKAN secara permanen.

import axios from 'axios';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { config } from './config.js'; // <-- TAMBAHAN IMPORT UNTUK AKSES API KEY
import FormData from 'form-data'; // <-- TAMBAHAN IMPORT UNTUK UPLOADIMAGE

// ============================ UTILITAS DASAR =================================
export const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));
export const sleep = delay;
export const tryDo = async (fn, fallback = null) => { try { return await fn(); } catch { return fallback; } };
export const chunk = (arr, size = 10) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; };
const streamToBuffer = async (stream) => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); };


// ============================ PENGIRIM PESAN DASAR ============================

/**
 * Mengirim pesan teks sederhana.
 */
export const sendMessage = async (sock, jid, text, options = {}) =>
  sock.sendMessage(jid, { text }, options);
export { sendMessage as sendText };

/**
 * Mengirim gambar dari URL atau Buffer.
 */
export const sendImage = async (sock, jid, urlOrBuffer, caption = '', viewOnce = false, options = {}) => {
  const image = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { image, caption, viewOnce }, options);
};

/**
 * Mengirim audio/voice note dari URL atau Buffer.
 */
export const sendAudio = async (sock, jid, urlOrBuffer, options = {}) => {
  const audio = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { audio, mimetype: options.mimetype || 'audio/mpeg', ptt: !!options.ptt }, options);
};

/**
 * Mengirim video dari URL atau Buffer.
 */
export const sendVideo = async (sock, jid, urlOrBuffer, caption = '', options = {}) => {
  const video = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { video, caption, mimetype: options.mimetype || 'video/mp4' }, options);
};


/**
 * Mengirim GIF dari URL atau Buffer.
 */
export const sendGif = async (sock, jid, urlOrBuffer, caption = '', options = {}) => {
  const video = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { video, caption, gifPlayback: true }, options);
};

/**
 * Mengirim dokumen dari URL atau Buffer.
 */
export const sendDoc = async (sock, jid, urlOrBuffer, fileName = 'file', mimetype = 'application/pdf', options = {}) => {
  const document = Buffer.isBuffer(urlOrBuffer) ? urlOrBuffer : { url: urlOrBuffer };
  return sock.sendMessage(jid, { document, fileName, mimetype }, options);
};

// ============================ PENGIRIM PESAN TIPE KHUSUS ============================

/**
 * Mengirim album gambar/video.
 */
export const sendAlbum = async (sock, jid, albumPayload = [], options = {}) => {
    if (!Array.isArray(albumPayload) || albumPayload.length === 0) {
        throw new Error("Payload untuk album tidak boleh kosong.");
    }
    return sock.sendMessage(jid, { album: albumPayload }, options);
};

/**
 * Mengirim pesan polling.
 */
export const sendPoll = async (sock, jid, name, values, options = {}) => {
  return sock.sendMessage(jid, { poll: { name, values, selectableCount: 1 } }, options);
};

/**
 * Mengirim pesan kontak (vCard).
 */
export const sendContact = async (sock, jid, fullName, org, waid, options = {}) => {
    const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + `FN:${fullName}\n` + `ORG:${org}\n` + `TEL;type=CELL;type=VOICE;waid=${waid}:+${waid}\n` + 'END:VCARD';
    return sock.sendMessage(jid, { contacts: { displayName: fullName, contacts: [{ vcard }] } }, options);
};

/**
 * Mengirim pesan lokasi.
 */
export const sendLocation = async (sock, jid, latitude, longitude, options = {}) => {
    return sock.sendMessage(jid, { location: { degreesLatitude: latitude, degreesLongitude: longitude } }, options);
};

// ============================ PENGIRIM PESAN INTERAKTIF ============================

/**
 * Mengirim carousel/cards gambar.
 */
export const sendCarousel = async (sock, jid, items = [], options = {}) => {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Items (kartu) tidak boleh kosong.');
  const cards = items.map(item => ({ image: { url: item.url }, title: item.title || '', body: item.body || '', ...(Array.isArray(item.buttons) && { buttons: item.buttons }), }));
  const messagePayload = { text: options.text || '', title: options.title || '', footer: options.footer || '', cards, };
  return sock.sendMessage(jid, messagePayload);
};

/**
 * Mengirim pesan daftar pilihan (list message).
 */
export const sendList = async (sock, jid, title, text, buttonText, sections = [], options = {}) => {
  const listMessage = { title, text, buttonText, sections };
  return sock.sendMessage(jid, listMessage, options);
};

/**
 * Mengirim pesan dengan tombol.
 */
export const sendButtons = async (sock, jid, text, footer, buttons = [], options = {}) => {
  const buttonsMessage = { text, footer, buttons: buttons.map(b => ({ buttonId: b.buttonId, buttonText: { displayText: b.displayText }, type: 1 })), };
  return sock.sendMessage(jid, buttonsMessage, options);
};

// ============================ AKSI PESAN & STATUS ============================

/**
 * Memberikan reaksi emoji pada sebuah pesan.
 */
export const react = async (sock, jid, key, emoji = '✅') => {
  try { return await sock.sendMessage(jid, { react: { text: emoji, key } }); } catch { }
};

/**
 * Mengedit teks dari pesan yang sudah terkirim.
 */
export const editMessage = async (sock, jid, newText, messageKey) =>
  sock.sendMessage(jid, { text: newText, edit: messageKey });

/**
 * Menghapus pesan untuk semua orang.
 */
export const deleteMessage = async (sock, jid, messageKey) =>
  sock.sendMessage(jid, { delete: messageKey });

/**
 * Meneruskan (forward) sebuah pesan ke chat lain.
 */
export const forwardMessage = async (sock, jid, message, options = {}) =>
    sock.sendMessage(jid, { forward: message }, options);
    
/**
 * Mengatur status kehadiran bot di sebuah chat.
 */
export const setPresence = async (sock, jid, state = 'composing') => {
  try { await sock.sendPresenceUpdate(state, jid); } catch { }
};

/**
 * Mensimulasikan status "sedang mengetik...".
 */
export const typing = async (sock, jid, seconds = 1.25) => {
  await setPresence(sock, jid, 'composing'); await delay(seconds * 1000); await setPresence(sock, jid, 'paused');
};


// ============================ DOWNLOADER / MIME ============================

/**
 * Mengunduh konten dari URL sebagai Buffer, dengan header penyamaran.
 * INI BAGIAN YANG DI-UPGRADE UNTUK MENGATASI ERROR 403.
 */
export const fetchAsBufferWithMime = async (url) => {
  try {
    const res = await axios.get(url, { 
        responseType: 'arraybuffer', 
        validateStatus: s => s >= 200 && s < 400,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
    });
    const mimetype = res.headers['content-type'] || '';
    return { buffer: Buffer.from(res.data), mimetype };
  } catch (error) {
    console.error(`Gagal fetch URL: ${url}`, error.message);
    throw new Error(`Gagal mengunduh konten dari URL. Server merespon dengan status: ${error.response?.status}`);
  }
};


/**
 * Mengunduh media (gambar/video/stiker) dari pesan.
 * Prioritas: Pesan saat ini -> Pesan yang di-reply.
 */
export const downloadMedia = async (message) => {
    let mediaMessage = message.message?.imageMessage || 
                       message.message?.videoMessage ||
                       message.message?.stickerMessage;
    
    if (!mediaMessage) {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
            mediaMessage = quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage;
        }
    }

    if (!mediaMessage) return null;

    try {
        const stream = await downloadContentFromMessage(mediaMessage, mediaMessage.videoMessage ? 'video' : 'image');
        return await streamToBuffer(stream);
    } catch (e) {
        console.error("Gagal mengunduh media:", e);
        return null;
    }
};


// ============================ IMAGE HELPER & UPLOADER ============================

/**
 * Mengunggah buffer gambar/file ke Szyrine API file host.
 */
export const uploadImage = async (buffer) => {
    if (!config.SZYRINE_API_KEY || config.SZYRINE_API_KEY === "YOUR_API_KEY_HERE") {
        throw new Error('SZYRINE_API_KEY belum diatur di config.js');
    }
    const form = new FormData();
    form.append('file', buffer, 'image.jpg');
    form.append('expiry', '1h');

    const { data } = await axios.post(`https://szyrineapi.biz.id/api/fileHost/upload?apikey=${config.SZYRINE_API_KEY}`, form, {
        headers: form.getHeaders(),
    });

    if (data.result && data.result.directLink) {
        return data.result.directLink;
    } else {
        throw new Error(data.result.message || 'Gagal mengunggah gambar atau mendapatkan direct link.');
    }
};

/**
 * Polling untuk job Pixnova sampai selesai atau gagal.
 */
export const pollPixnovaJob = async (statusUrl) => {
    for (let i = 0; i < 20; i++) {
        await delay(3000);
        try {
            const { data } = await axios.get(statusUrl);
            if (data.result?.status === 'completed') {
                return data.result.result.imageUrl;
            }
            if (data.result?.status === 'failed' || data.result?.status === 'error') {
                throw new Error(`Proses job gagal: ${data.result.message || 'Alasan tidak diketahui'}`);
            }
        } catch (e) {}
    }
    throw new Error('Waktu pemrosesan habis (timeout).');
};


// ============================ EXPORT DEFAULT =================================
export default {
  // Utils
  delay, sleep, tryDo, chunk,
  // Senders
  sendMessage, sendText: sendMessage,
  sendImage, sendAudio, sendVideo, sendGif, sendDoc,
  sendAlbum, sendPoll, sendContact, sendLocation,
  sendCarousel, sendList, sendButtons,
  // Actions & Presence
  react, editMessage, deleteMessage, forwardMessage,
  setPresence, typing,
  // Downloader
  fetchAsBufferWithMime,
  downloadMedia,
};