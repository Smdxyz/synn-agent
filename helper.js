// helper.js — THE ULTIMATE VERSION (ALL FEATURES INCLUDED)

import got from 'got';
import { 
    downloadContentFromMessage, 
    generateWAMessage,
    generateWAMessageContent,
    generateWAMessageFromContent,
    generateMessageID,
    prepareWAMessageMedia
} from '@whiskeysockets/baileys';
import { randomBytes, createHash } from 'crypto';
import { config } from './config.js';
import FormData from 'form-data';
import axios from 'axios';
import baileysHelpers from 'baileys_helpers';
import { zip } from 'fflate';
// Impor fungsi dari utils.js yang baru kita buat
import { getStream, toBuffer, sleep as delay } from './libs/utils.js';

// ============================ UTILITAS =================================
const sha256 = (data) => createHash('sha256').update(data).digest();
// Ekspor ulang fungsi dari utils agar bisa diakses dari H.delay
export { delay };

// ============================ PENGIRIM PESAN DASAR ============================
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

// ============================ PENGIRIM PESAN TIPE KHUSUS ============================

/**
 * Mengirim stiker dari gambar atau video.
 * Catatan: Media harus sudah dikonversi menjadi Buffer WebP sebelum memanggil fungsi ini.
 */
export const sendSticker = async (sock, jid, stickerBuffer, options = {}) => {
    return sock.sendMessage(jid, { sticker: stickerBuffer, ...options });
};

/**
 * Mengirim paket stiker kustom, meniru logika itsukichan.
 */
export const sendStickerPack = async (sock, jid, packData, options = {}) => {
    const { stickers, cover, name, publisher, packId, description } = packData;

    const stickerData = {};
    const stickerPromises = stickers.map(async (s, i) => {
        const { stream } = await getStream(s.sticker);
        const buffer = await toBuffer(stream);
        const hash = sha256(buffer).toString('base64url');
        const fileName = `${i.toString().padStart(2, '0')}_${hash}.webp`;
        stickerData[fileName] = [new Uint8Array(buffer), { level: 0 }];

        return {
            fileName,
            mimetype: 'image/webp',
            isAnimated: s.isAnimated || false,
            isLottie: s.isLottie || false,
            emojis: s.emojis || [],
            accessibilityLabel: s.accessibilityLabel || ''
        };
    });

    const stickerMetadata = await Promise.all(stickerPromises);

    const zipBuffer = await new Promise((resolve, reject) => {
        zip(stickerData, (err, data) => err ? reject(err) : resolve(Buffer.from(data)));
    });

    const { stream: coverStream } = await getStream(cover);
    const coverBuffer = await toBuffer(coverStream);
    const userJid = sock.user.id;

    const [stickerPackUploadResult, coverUploadResult] = await Promise.all([
        sock.waUploadToServer(zipBuffer, { mediaType: 'sticker-pack' }),
        prepareWAMessageMedia({ image: coverBuffer }, { 
            upload: sock.waUploadToServer,
            mediaTypeOverride: 'image',
            logger: sock.logger,
            options: sock.options,
            userJid
        })
    ]);

    const coverImage = coverUploadResult.imageMessage;
    const imageDataHash = sha256(coverBuffer).toString('base64');
    const stickerPackId = packId || generateMessageID();

    const finalContent = {
        stickerPackMessage: {
            name, publisher, stickerPackId,
            packDescription: description,
            stickerPackOrigin: 1, // THIRD_PARTY
            stickerPackSize: stickerPackUploadResult.fileLength,
            stickers: stickerMetadata,
            fileSha256: stickerPackUploadResult.fileSha256,
            fileEncSha256: stickerPackUploadResult.fileEncSha256,
            mediaKey: stickerPackUploadResult.mediaKey,
            directPath: stickerPackUploadResult.directPath,
            fileLength: stickerPackUploadResult.fileLength,
            mediaKeyTimestamp: stickerPackUploadResult.mediaKeyTimestamp,
            trayIconFileName: `${stickerPackId}.png`,
            imageDataHash,
            thumbnailDirectPath: coverImage.directPath,
            thumbnailFileSha256: coverImage.fileSha256,
            thumbnailFileEncSha256: coverImage.fileEncSha256,
            thumbnailHeight: coverImage.height,
            thumbnailWidth: coverImage.width
        }
    };
    
    return sock.sendMessage(jid, finalContent, options);
};

export const sendAlbum = async (sock, jid, albumPayload = [], options = {}) => {
    if (!Array.isArray(albumPayload) || albumPayload.length === 0) {
        throw new Error("Payload untuk album tidak boleh kosong.");
    }
    const userJid = sock.user.id;
    const messageId = generateMessageID();
    const imageCount = albumPayload.filter(item => 'image' in item).length;
    const videoCount = albumPayload.filter(item => 'video' in item).length;
    const containerMessageContent = {
        albumMessage: { expectedImageCount: imageCount, expectedVideoCount: videoCount }
    };
    const containerMsg = generateWAMessageFromContent(jid, containerMessageContent, { userJid, messageId });
    await sock.relayMessage(jid, containerMsg.message, { messageId: containerMsg.key.id });
    const sentMessages = [containerMsg];
    for (const media of albumPayload) {
        await delay(100);
        const mediaMsg = await generateWAMessage(jid, media, { ...options, userJid, upload: sock.waUploadToServer });
        mediaMsg.message.messageContextInfo = {
            messageSecret: randomBytes(32),
            messageAssociation: {
                associationType: 1, // WAProto.MessageAssociation.Type.ALBUM
                parentMessageKey: containerMsg.key
            }
        };
        await sock.relayMessage(jid, mediaMsg.message, { messageId: mediaMsg.key.id });
        sentMessages.push(mediaMsg);
    }
    return sentMessages;
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

// ============================ PENGIRIM PESAN INTERAKTIF ============================

export const sendCarousel = async (sock, jid, cards = [], options = {}) => {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error('Payload `cards` tidak boleh kosong.');
  }
  const userJid = sock.user.id;
  const cardProcessingPromises = cards.map(async (card) => {
    try {
      const { image, video, body, footer, buttons } = card;
      let preparedMedia = image ? { image } : video ? { video } : null;
      if (!preparedMedia) throw new Error('Setiap kartu harus memiliki `image` atau `video`.');
      const mediaContent = await generateWAMessageContent(
        preparedMedia,
        { upload: sock.waUploadToServer, logger: sock.logger, options: sock.options, userJid }
      );
      if (!mediaContent.imageMessage && !mediaContent.videoMessage) {
          throw new Error('Gagal memproses media, hasilnya kosong.');
      }
      const nativeFlowButtons = (buttons || []).map(btn => ({
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: btn.displayText, id: btn.id || btn.buttonId })
      }));
      return {
        header: {
          ...(mediaContent.imageMessage && { imageMessage: mediaContent.imageMessage }),
          ...(mediaContent.videoMessage && { videoMessage: mediaContent.videoMessage }),
          hasMediaAttachment: true,
        },
        body: { text: body || '' },
        footer: { text: footer || '' },
        nativeFlowMessage: { buttons: nativeFlowButtons, messageParamsJson: '' }
      };
    } catch (error) {
        console.error(`[sendCarousel] Gagal memproses satu kartu: ${error.message}`);
        return null;
    }
  });
  const processedCards = (await Promise.all(cardProcessingPromises)).filter(Boolean);
  if (processedCards.length === 0) {
      throw new Error('Semua kartu gagal diproses. Tidak ada yang bisa ditampilkan.');
  }
  const interactiveMessage = {
    body: { text: options.text || '' },
    footer: { text: options.footer || '' },
    header: { title: options.title || '', hasMediaAttachment: false },
    carouselMessage: { cards: processedCards, messageVersion: 1 }
  };
  const finalMessage = {
    viewOnceMessageV2Extension: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: interactiveMessage
      }
    }
  };
  const fullMsg = generateWAMessageFromContent(jid, finalMessage, { ...options, userJid, messageId: options.messageId || generateMessageID() });
  await sock.relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id });
  return fullMsg;
};

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
        if (quoted) {
            mediaMessage = quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage;
            if (!mediaMessage) {
                const interactiveMsg = quoted.viewOnceMessageV2Extension?.message?.interactiveMessage || quoted.interactiveMessage;
                if (interactiveMsg) {
                    const carouselCards = interactiveMsg.carouselMessage?.cards;
                    if (carouselCards && carouselCards.length > 0) {
                        mediaMessage = carouselCards[0].header?.imageMessage || carouselCards[0].header?.videoMessage;
                    }
                }
            }
        }
    }
    if (!mediaMessage) return null;
    try {
        const mimetype = mediaMessage.mimetype;
        const stream = await downloadContentFromMessage(mediaMessage, mediaMessage.videoMessage ? 'video' : (mediaMessage.stickerMessage ? 'sticker' : 'image'));
        const buffer = await toBuffer(stream);
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
  delay,
  sendMessage, sendText: sendMessage,
  sendImage, sendAudio, sendVideo, sendGif, sendDoc,
  sendSticker, sendStickerPack, sendAlbum, sendPoll, sendContact, sendLocation,
  sendCarousel, sendList, sendButtons, sendInteractiveMessage,
  react, editMessage, deleteMessage, forwardMessage,
  setPresence, typing,
  fetchAsBufferWithMime, downloadMedia, uploadImage, pollPixnovaJob,
};