import fs from "fs";
import path from "path";
import sharp from "sharp";
import H from "../../helper.js";

import * as JimpPkg from "jimp";
import QrCode from "qrcode-reader";
const Jimp = JimpPkg.Jimp ?? JimpPkg.default ?? JimpPkg;

const DATA_DIR = path.resolve("./data");
const STORE_PATH = path.join(DATA_DIR, "qris_store.json");
const LOGO_PATH = path.join(DATA_DIR, "qris_logo.png");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readStore() {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); } catch { return {}; }
}
function writeStore(obj) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2), "utf8");
}

function decodeQrPayloadFromBuffer(imgBuffer) {
  return new Promise(async (resolve, reject) => {
    try {
      const img = await Jimp.read(imgBuffer);
      if (typeof img.greyscale === "function") img.greyscale();
      else if (typeof img.grayscale === "function") img.grayscale();
      if (typeof img.contrast === "function") img.contrast(0.2);

      const qr = new QrCode();
      qr.callback = (err, value) => {
        if (err || !value?.result) return reject(new Error("QR tidak kebaca."));
        resolve(String(value.result));
      };
      qr.decode(img.bitmap);
    } catch (e) {
      reject(new Error("Gagal decode QR: " + (e?.message || e)));
    }
  });
}

function parseTLV(s) {
  const out = {};
  let i = 0;
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const len = parseInt(s.slice(i + 2, i + 4), 10);
    if (!Number.isFinite(len) || i + 4 + len > s.length) break;
    out[tag] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

export const aliases = ["qrisset", "setqris"];

export default async function qrisset(sock, message, args, query, sender) {
  const media = await H.downloadMedia(message);
  if (!media?.buffer) {
    return sock.sendMessage(sender, { text: "Reply/kirim gambar QRIS atau logo dulu, lalu ketik `.qrisset`" }, { quoted: message });
  }

  // coba decode QR dulu
  let payload = null;
  try {
    payload = await decodeQrPayloadFromBuffer(media.buffer);
  } catch {
    payload = null;
  }

  // kalau kebaca QRIS -> simpan payload
  if (payload && payload.startsWith("000201") && payload.includes("6304")) {
    const tlv = parseTLV(payload);
    const isNominal = Boolean(tlv["54"]);

    const store = readStore();
    store.payload = payload;
    store.type = isNominal ? "nominal" : "static";
    store.updated_at = new Date().toISOString();
    writeStore(store);

    return sock.sendMessage(
      sender,
      { text: `✅ QRIS tersimpan.\nTipe: ${isNominal ? "Nominal (Fixed)" : "Biasa (Static)"}\nSekarang bisa pakai:\n- .qriscreate\n- .qriscreate 5000 10m` },
      { quoted: message }
    );
  }

  // kalau bukan QRIS -> anggap itu LOGO, simpan logo square
  try {
    ensureDir();
    const logoSquare = await sharp(media.buffer)
      .resize(512, 512, { fit: "cover", position: "centre" }) // auto crop jadi 1:1
      .png()
      .toBuffer();

    fs.writeFileSync(LOGO_PATH, logoSquare);

    const store = readStore();
    store.logo = "qris_logo.png";
    store.logo_updated_at = new Date().toISOString();
    writeStore(store);

    return sock.sendMessage(
      sender,
      { text: "✅ Logo tersimpan (auto-crop square). Sekarang `.qriscreate` bakal pakai logo ini di tengah." },
      { quoted: message }
    );
  } catch (e) {
    return sock.sendMessage(sender, { text: "Gagal simpan logo: " + (e?.message || e) }, { quoted: message });
  }
}