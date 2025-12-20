import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";

function crc32Hex(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  return crc.toString(16).padStart(8, "0");
}

function bitsFromBuffer(buf) {
  const bits = [];
  for (const b of buf) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  return bits;
}

function bufferFromBits(bits) {
  const out = Buffer.alloc(Math.ceil(bits.length / 8), 0);
  for (let i = 0; i < bits.length; i++) {
    const byteIndex = (i / 8) | 0;
    const bitInByte = 7 - (i % 8);
    out[byteIndex] |= bits[i] << bitInByte;
  }
  return out;
}

function seededIndexStream(seedBuf, count, max) {
  // deterministic “random” index list (no secret needed) based on seed
  // so extractor bisa jalan pakai public key saja
  const idx = [];
  let counter = 0;
  while (idx.length < count) {
    const h = crypto
      .createHash("sha256")
      .update(seedBuf)
      .update(Buffer.from(String(counter++)))
      .digest();
    for (let i = 0; i < h.length && idx.length < count; i += 4) {
      const v = h.readUInt32BE(i) % max;
      idx.push(v);
    }
  }
  return idx;
}

export function loadKeys({ privatePemPath = "wm_private.pem", publicPemPath = "wm_public.pem" } = {}) {
  const publicPem = fs.readFileSync(publicPemPath, "utf8");
  const pubFp = crypto.createHash("sha256").update(publicPem).digest("hex").slice(0, 16);

  let privatePem = null;
  if (fs.existsSync(privatePemPath)) privatePem = fs.readFileSync(privatePemPath, "utf8");

  return { publicPem, privatePem, pubFp };
}

/**
 * Packet format:
 * MAGIC(4) "WMK2"
 * LEN(4)  payload length
 * CRC(4)  crc32(payload)
 * PAYLOAD bytes (JSON UTF-8)
 *
 * Embed method:
 * - Convert to raw RGBA
 * - Use BLUE channel LSB
 * - Repeat each bit R times (default 5) across spread indices
 */
export async function embedWatermark(buffer, {
  creator = "unknown",
  note = "",
  privatePem, // required to SIGN
  publicPem,  // embedded fingerprint only
  repeat = 5,
  forcePng = true,
} = {}) {
  if (!privatePem) throw new Error("Missing private key (wm_private.pem). Run: npm run wm:keygen");

  const pubFp = crypto.createHash("sha256").update(publicPem || "").digest("hex").slice(0, 16);

  // Build signed payload
  const nonce = crypto.randomBytes(6).toString("hex");
  const ts = new Date().toISOString();
  const contentSha = crypto.createHash("sha256").update(buffer).digest("hex");

  const payloadObj = {
    v: 1,
    creator,
    ts,
    nonce,
    contentSha256: contentSha,
    pubFp,
    note,
  };

  const payloadJson = Buffer.from(JSON.stringify(payloadObj), "utf8");
  const signature = crypto.sign(null, payloadJson, privatePem); // Ed25519 uses null algo
  const signedObj = {
    ...payloadObj,
    sig_b64: signature.toString("base64"),
  };
  const signedJson = Buffer.from(JSON.stringify(signedObj), "utf8");

  const magic = Buffer.from("WMK2");
  const len = Buffer.alloc(4); len.writeUInt32BE(signedJson.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(parseInt(crc32Hex(signedJson), 16) >>> 0, 0);

  const packet = Buffer.concat([magic, len, crc, signedJson]);
  const bits = bitsFromBuffer(packet);

  // Decode -> raw
  const img = sharp(buffer);
  const meta = await img.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  const raw = await img.ensureAlpha().raw().toBuffer();
  const pixels = width * height;

  const neededSlots = bits.length * repeat;
  if (neededSlots > pixels) {
    throw new Error(`Image too small: need ${neededSlots} pixels, got ${pixels}. Use bigger image or lower repeat.`);
  }

  const seed = crypto.createHash("sha256").update(Buffer.from(publicPem || "public")).update(Buffer.from([width & 255, height & 255])).digest();
  const indices = seededIndexStream(seed, neededSlots, pixels);

  // Embed with repetition majority
  let p = 0;
  for (let bi = 0; bi < bits.length; bi++) {
    const bit = bits[bi];
    for (let r = 0; r < repeat; r++) {
      const pixIndex = indices[p++];
      const base = pixIndex * 4;
      const bIndex = base + 2;
      raw[bIndex] = (raw[bIndex] & 0xfe) | bit;
    }
  }

  const out = sharp(raw, { raw: { width, height, channels: 4 } });

  // Output: PNG recommended (preserve LSB)
  const outBuf = forcePng
    ? await out.png({ compressionLevel: 9 }).toBuffer()
    : await out.toBuffer();

  return {
    buffer: outBuf,
    payload: signedObj,
    pubFp,
  };
}

export async function extractWatermark(buffer, {
  publicPem,
  repeat = 5,
} = {}) {
  if (!publicPem) throw new Error("Missing public key (wm_public.pem)");

  const img = sharp(buffer);
  const meta = await img.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  const raw = await img.ensureAlpha().raw().toBuffer();
  const pixels = width * height;

  // We don't know packet length yet. Read header first:
  // MAGIC(4)+LEN(4)+CRC(4) = 12 bytes = 96 bits
  const headerBitsCount = 12 * 8;
  const headerSlots = headerBitsCount * repeat;
  if (headerSlots > pixels) throw new Error("Image too small for header.");

  const seed = crypto.createHash("sha256").update(Buffer.from(publicPem)).update(Buffer.from([width & 255, height & 255])).digest();
  const indicesHeader = seededIndexStream(seed, headerSlots, pixels);

  const readBitMajority = (startSlot) => {
    let ones = 0;
    for (let r = 0; r < repeat; r++) {
      const pixIndex = indicesHeader[startSlot + r];
      const b = raw[pixIndex * 4 + 2] & 1;
      ones += b;
    }
    return ones > (repeat / 2) ? 1 : 0;
  };

  // Read header bits
  const headerBits = [];
  for (let i = 0; i < headerBitsCount; i++) {
    headerBits.push(readBitMajority(i * repeat));
  }
  const headerBuf = bufferFromBits(headerBits);

  const magic = headerBuf.subarray(0, 4).toString("ascii");
  if (magic !== "WMK2") throw new Error("No WMK2 watermark found (magic mismatch).");

  const len = headerBuf.readUInt32BE(4);
  const storedCrc = headerBuf.readUInt32BE(8) >>> 0;

  const totalBits = (12 + len) * 8;
  const totalSlots = totalBits * repeat;
  if (totalSlots > pixels) throw new Error("Image too small for full payload.");

  // Need indices for full packet
  const indicesAll = seededIndexStream(seed, totalSlots, pixels);

  const readBitMajorityAll = (startSlot) => {
    let ones = 0;
    for (let r = 0; r < repeat; r++) {
      const pixIndex = indicesAll[startSlot + r];
      const b = raw[pixIndex * 4 + 2] & 1;
      ones += b;
    }
    return ones > (repeat / 2) ? 1 : 0;
  };

  const allBits = [];
  for (let i = 0; i < totalBits; i++) {
    allBits.push(readBitMajorityAll(i * repeat));
  }
  const packet = bufferFromBits(allBits);

  const payload = packet.subarray(12, 12 + len);
  const crcHex = crc32Hex(payload);
  const crcNum = parseInt(crcHex, 16) >>> 0;

  if (crcNum !== storedCrc) {
    throw new Error("WM found but corrupted (CRC mismatch). Image likely recompressed/edited.");
  }

  const payloadObj = JSON.parse(payload.toString("utf8"));
  const sig = Buffer.from(payloadObj.sig_b64 || "", "base64");

  const payloadUnsigned = { ...payloadObj };
  delete payloadUnsigned.sig_b64;

  const unsignedJson = Buffer.from(JSON.stringify(payloadUnsigned), "utf8");
  const ok = crypto.verify(null, unsignedJson, publicPem, sig);

  return {
    detected: true,
    signatureValid: ok,
    payload: payloadObj,
  };
}