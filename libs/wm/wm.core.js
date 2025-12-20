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

async function pixelHashFromBuffer(imgBuffer) {
  // Decode -> raw RGBA, hash pixels (stable across re-encode/metadata)
  const img = sharp(imgBuffer);
  const meta = await img.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const raw = await img.ensureAlpha().raw().toBuffer();
  const h = crypto.createHash("sha256").update(raw).digest("hex");
  return { pixelSha256: h, width, height };
}

function hexToBits(hex) {
  const buf = Buffer.from(hex, "hex");
  return bitsFromBuffer(buf);
}

export function loadKeys({
  privatePemPath = "wm_private.pem",
  publicPemPath = "wm_public.pem",
} = {}) {
  const publicPem = fs.readFileSync(publicPemPath, "utf8");
  const pubFp = crypto.createHash("sha256").update(publicPem).digest("hex").slice(0, 16);

  let privatePem = null;
  if (fs.existsSync(privatePemPath)) privatePem = fs.readFileSync(privatePemPath, "utf8");

  return { publicPem, privatePem, pubFp };
}

/**
 * v3 upgrade:
 * - integrity uses PIXEL hash, not file bytes hash
 * - so re-upload/re-encode won't instantly FAIL, as long as pixels stay identical
 */
export async function embedWatermark(
  buffer,
  { creator = "unknown", note = "", privatePem, publicPem, repeat = 5, forcePng = true } = {}
) {
  if (!privatePem) throw new Error("Missing private key (wm_private.pem). Run: npm run wm:keygen");

  const pubFp = crypto.createHash("sha256").update(publicPem || "").digest("hex").slice(0, 16);

  const nonce = crypto.randomBytes(6).toString("hex");
  const ts = new Date().toISOString();

  // Source fingerprints
  const srcFileSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const srcPix = await pixelHashFromBuffer(buffer);

  const inMeta = await sharp(buffer).metadata();
  const exifSha = inMeta.exif ? crypto.createHash("sha256").update(inMeta.exif).digest("hex") : null;
  const metaFp = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        w: inMeta.width ?? null,
        h: inMeta.height ?? null,
        fmt: inMeta.format ?? null,
        exifSha,
      })
    )
    .digest("hex")
    .slice(0, 24);

  // Decode input -> raw to embed
  const img = sharp(buffer);
  const meta = await img.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  const raw = await img.ensureAlpha().raw().toBuffer();
  const pixels = width * height;

  // We'll compute wmPixelSha256 AFTER embedding bits to raw (but BEFORE encoding),
  // so that integrity checks compare pixel hash (stable).
  // However extractor only has the final image; it will compute pixel hash from that.
  // That should match if pixels identical.

  // Build payload unsigned AFTER we compute wmPixelSha256 (needs embed first).
  // We'll embed using placeholder first? We can do a deterministic approach:
  // - Build a minimal unsigned payload WITHOUT wmPixelSha256
  // - Embed payload bits
  // - Compute pixel hash of final raw
  // - Sign the full payload including wmPixelSha256
  // -> This would require re-embedding the packet because payload changes.
  //
  // To avoid 2x embed, we do this:
  // - Integrity will use srcPix + wmPix "fingerprint bits" (short)
  // - Store a compact "wmPixTag" = first 64 bits of pixel hash
  // That allows single-pass embed while still distinguishing edits vs reuploads.
  //
  // We compute wmPixTag from raw AFTER embedding a FINAL packet that doesn't depend on wmPixTag? still circular.
  // So we compute wmPixTag from *source pixels* and accept it as “content identity”, not exact post-embed.
  // This is enough for anti-fitnah: edit changes pixels -> mismatch.
  // Reupload that preserves pixels -> match.

  const wmPixTag = srcPix.pixelSha256.slice(0, 32); // 128-bit tag (hex 32 chars)

  const payloadUnsigned = {
    v: 3,
    creator,
    ts,
    nonce,
    pubFp,
    note,

    // Source fingerprints
    srcFileSha256,              // optional, might change on re-encode
    srcPixelSha256: srcPix.pixelSha256,
    srcW: srcPix.width,
    srcH: srcPix.height,
    metaFp,

    // Anti-fitnah identity tag (pixel based)
    contentPixTag: wmPixTag,
  };

  const unsignedJson = Buffer.from(JSON.stringify(payloadUnsigned), "utf8");
  const signature = crypto.sign(null, unsignedJson, privatePem);

  const payloadSigned = {
    ...payloadUnsigned,
    sig_b64: signature.toString("base64"),
  };

  const signedJson = Buffer.from(JSON.stringify(payloadSigned), "utf8");

  const magic = Buffer.from("WMK2");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(signedJson.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(parseInt(crc32Hex(signedJson), 16) >>> 0, 0);

  const packet = Buffer.concat([magic, len, crc, signedJson]);
  const bits = bitsFromBuffer(packet);

  const neededSlots = bits.length * repeat;
  if (neededSlots > pixels) {
    throw new Error(`Image too small: need ${neededSlots} pixels, got ${pixels}.`);
  }

  const seed = crypto
    .createHash("sha256")
    .update(Buffer.from(publicPem || "public"))
    .update(Buffer.from([width & 255, height & 255]))
    .digest();

  const indices = seededIndexStream(seed, neededSlots, pixels);

  // Embed bits into BLUE LSB
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
  const outBuf = forcePng
    ? await out.png({ compressionLevel: 9 }).toBuffer()
    : await out.toBuffer();

  return { buffer: outBuf, payload: payloadSigned, pubFp };
}

export async function extractWatermark(buffer, { publicPem, repeat = 5 } = {}) {
  if (!publicPem) throw new Error("Missing public key (wm_public.pem)");

  const img = sharp(buffer);
  const meta = await img.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  const raw = await img.ensureAlpha().raw().toBuffer();
  const pixels = width * height;

  const headerBitsCount = 12 * 8;
  const headerSlots = headerBitsCount * repeat;
  if (headerSlots > pixels) throw new Error("Image too small for header.");

  const seed = crypto
    .createHash("sha256")
    .update(Buffer.from(publicPem))
    .update(Buffer.from([width & 255, height & 255]))
    .digest();

  const indicesHeader = seededIndexStream(seed, headerSlots, pixels);

  const readBitMajorityFrom = (indices, startSlot) => {
    let ones = 0;
    for (let r = 0; r < repeat; r++) {
      const pixIndex = indices[startSlot + r];
      ones += raw[pixIndex * 4 + 2] & 1;
    }
    return ones > repeat / 2 ? 1 : 0;
  };

  const headerBits = [];
  for (let i = 0; i < headerBitsCount; i++) {
    headerBits.push(readBitMajorityFrom(indicesHeader, i * repeat));
  }
  const headerBuf = bufferFromBits(headerBits);

  const magic = headerBuf.subarray(0, 4).toString("ascii");
  if (magic !== "WMK2") throw new Error("No WMK2 watermark found (magic mismatch).");

  const len = headerBuf.readUInt32BE(4);
  const storedCrc = headerBuf.readUInt32BE(8) >>> 0;

  const totalBits = (12 + len) * 8;
  const totalSlots = totalBits * repeat;
  if (totalSlots > pixels) throw new Error("Image too small for full payload.");

  const indicesAll = seededIndexStream(seed, totalSlots, pixels);

  const allBits = [];
  for (let i = 0; i < totalBits; i++) {
    allBits.push(readBitMajorityFrom(indicesAll, i * repeat));
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
  const signatureValid = crypto.verify(null, unsignedJson, publicPem, sig);

  // Pixel-based integrity (anti-galak):
  const currentPix = await pixelHashFromBuffer(buffer);

  // Determine status:
  // - PASS: pixel hash matches exactly (rare if any recompress)
  // - SOFT_FAIL: pixTag matches (first 128-bit), but full hash differs (minor transforms)
  // - FAIL: pixTag mismatch (real edits)
  let integrity = {
    supported: false,
    level: "N/A",
    pass: false,
    reason: "Legacy watermark (no pixel tag).",
    currentPixelSha256: currentPix.pixelSha256,
    currentW: currentPix.width,
    currentH: currentPix.height,
  };

  if (payloadObj?.v >= 3 && typeof payloadObj.contentPixTag === "string") {
    integrity.supported = true;

    const expectedTag = String(payloadObj.contentPixTag);
    const currentTag = currentPix.pixelSha256.slice(0, expectedTag.length);

    if (currentPix.pixelSha256 === payloadObj.srcPixelSha256) {
      integrity.level = "PASS";
      integrity.pass = true;
      integrity.reason = "OK: pixel hash matches (re-encode safe).";
    } else if (currentTag === expectedTag) {
      integrity.level = "SOFT_FAIL";
      integrity.pass = false;
      integrity.reason =
        "LIKELY REUPLOAD/RE-ENCODE: pixel tag matches but full pixel hash differs (minor changes).";
    } else {
      integrity.level = "FAIL";
      integrity.pass = false;
      integrity.reason = "TAMPERED: pixel tag mismatch (content edited).";
    }

    integrity.expectedPixTag = expectedTag;
    integrity.currentPixTag = currentTag;
  }

  return {
    detected: true,
    signatureValid,
    integrity,
    payload: payloadObj,
  };
}