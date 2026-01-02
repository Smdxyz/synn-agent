import fs from "fs";
import path from "path";
import crypto from "crypto";
import QRCode from "qrcode";
import sharp from "sharp";

const DATA_DIR = path.resolve("./data");
const STORE_PATH = path.join(DATA_DIR, "qris_store.json");
const LOGO_PATH = path.join(DATA_DIR, "qris_logo.png");
const LOG_PATH = path.join(DATA_DIR, "qris_log.jsonl");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readStore() {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); } catch { return null; }
}
function appendLog(obj) {
  ensureDir();
  fs.appendFileSync(LOG_PATH, JSON.stringify(obj) + "\n", "utf8");
}

function crc16ccittFalse(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function parseTLVList(s) {
  const out = [];
  let i = 0;
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const len = parseInt(s.slice(i + 2, i + 4), 10);
    if (!Number.isFinite(len) || i + 4 + len > s.length) break;
    out.push({ tag, value: s.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}
function buildTLV(tag, value) {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

// bikin payload fixed amount dari payload QRIS (umumnya static)
function makeFixedAmountPayload(basePayload, amount) {
  const amt = String(amount).replace(/[^\d]/g, "");
  if (!amt || amt === "0") throw new Error("Nominal tidak valid");

  // buang CRC lama kalau ada
  const withoutCrc = basePayload.replace(/6304[0-9A-Fa-f]{4}$/, "");

  const tlvs = parseTLVList(withoutCrc);
  const map = new Map(tlvs.map(x => [x.tag, x.value]));

  // set POI method 01 -> 12 (dynamic/fixed)
  map.set("01", "12");
  // set amount 54
  map.set("54", amt);

  // rebuild urutan umum biar rapi
  const order = ["00","01","26","27","28","29","30","31","32","33","34","35","36","37","38","39",
                 "40","41","42","43","44","45","46","47","48","49","50","51",
                 "52","53","54","55","56","57","58","59","60","61","62"];
  let rebuilt = "";
  for (const t of order) if (map.has(t)) rebuilt += buildTLV(t, map.get(t));
  for (const [t, v] of map.entries()) if (!order.includes(t) && t !== "63") rebuilt += buildTLV(t, v);

  const crc = crc16ccittFalse(rebuilt + "6304");
  return rebuilt + "6304" + crc;
}

function parseDurationToMs(s) {
  // default 10m
  if (!s) return 10 * 60 * 1000;
  const m = String(s).trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!m) return 10 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
  return n * mult;
}

async function renderQrWithLogo(payload) {
  const qrPng = await QRCode.toBuffer(payload, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 2,
    scale: 10,
  });

  const base = sharp(qrPng);
  const meta = await base.metadata();
  const size = Math.min(meta.width || 1024, meta.height || 1024);

  // kalau ada logo: crop square + resize kecil (aman 18–22% dari QR)
  if (fs.existsSync(LOGO_PATH)) {
    const logoSize = Math.floor(size * 0.20);
    const logoBuf = await sharp(LOGO_PATH)
      .resize(logoSize, logoSize, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();

    // kasih “white pad” biar logo kebaca dan QR tetap gampang discan
    const pad = Math.floor(logoSize * 0.14);
    const whiteBox = await sharp({
      create: {
        width: logoSize + pad * 2,
        height: logoSize + pad * 2,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    }).png().toBuffer();

    return await base
      .composite([
        { input: whiteBox, left: Math.floor((size - (logoSize + pad * 2)) / 2), top: Math.floor((size - (logoSize + pad * 2)) / 2) },
        { input: logoBuf, left: Math.floor((size - logoSize) / 2), top: Math.floor((size - logoSize) / 2) },
      ])
      .png()
      .toBuffer();
  }

  // kalau gak ada logo, return QR biasa
  return qrPng;
}

export const aliases = ["qriscreate", "qcreate"];

export default async function qriscreate(sock, message, args, query, sender) {
  const store = readStore();
  if (!store?.payload) {
    return sock.sendMessage(sender, { text: "Belum set QRIS. Kirim/reply gambar QRIS lalu `.qrisset`" }, { quoted: message });
  }

  // usage:
  // .qriscreate -> pakai payload tersimpan
  // .qriscreate 5000 10m -> fixed amount + masa aktif
  const amount = args?.[0] ? String(args[0]).replace(/[^\d]/g, "") : "";
  const ttlStr = args?.[1] ? String(args[1]) : "";
  const ttlMs = parseDurationToMs(ttlStr);

  let payload = store.payload;
  let mode = "static";
  let expiresAt = null;

  if (amount) {
    payload = makeFixedAmountPayload(store.payload, amount);
    mode = "nominal";
    expiresAt = new Date(Date.now() + ttlMs).toISOString();

    appendLog({
      ts: new Date().toISOString(),
      mode,
      amount: Number(amount),
      expires_at: expiresAt,
      crc: payload.match(/6304([0-9A-F]{4})$/)?.[1] || null,
    });
  }

  const outPng = await renderQrWithLogo(payload);
  const filename = `qris_${mode}_${crypto.randomBytes(4).toString("hex")}.png`;

  const captionLines = [
    `✅ QR dibuat: *${mode === "nominal" ? "Nominal (Fixed)" : "Biasa (Static)"}*`,
    amount ? `• Nominal: Rp ${amount}` : `• Nominal: (input pembayar)`,
  ];
  if (expiresAt) captionLines.push(`• Masa aktif (internal): ${ttlStr || "10m"} (exp: ${expiresAt})`);
  captionLines.push(`• Logo: ${fs.existsSync(LOGO_PATH) ? "ON" : "OFF"}`);

  return sock.sendMessage(
    sender,
    { image: outPng, fileName: filename, caption: captionLines.join("\n") },
    { quoted: message }
  );
}

export const cost = 2;
