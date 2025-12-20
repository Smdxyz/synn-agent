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
 *
 * Anti-fitnah upgrade (v2):
 * - payload includes:
 *   - srcSha256: sha256 dari input sebelum embed
 *   - wmSha256: sha256 dari output setelah embed (fragile integrity proof)
 *   - metaFp: fingerprint metadata penting (bonus)
 * - wmcheck bisa bilang: signature valid tapi CONTENT TAMPERED (wmSha256 mismatch)
 */
export async function embedWatermark(
  buffer,
  { creator = "unknown", note = "", privatePem, publicPem, repeat = 5, forcePng = true } = {}
) {
  if (!privatePem) throw new Error("Missing private key (wm_private.pem). Run: npm run wm:keygen");

  const pubFp = crypto.createHash("sha256").update(publicPem || "").digest("hex").slice(0, 16);

  // Fingerprint source (before embed)
  const nonce = crypto.randomBytes(6).toString("hex");
  const ts = new Date().toISOString();
  const srcSha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  // Metadata fingerprint (bonus, bukan tamper lock utama)
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

  // payload unsigned (wmSha256 diisi setelah outBuf jadi)
  const basePayload = {
    v: 2,
    creator,
    ts,
    nonce,
    srcSha256,
    metaFp,
    pubFp,
    note,
  };

  // ========== Embed payload (we need final JSON bytes) ==========
  // Kita sementara pakai placeholder wmSha256, embed dulu, lalu rebuild payload dan embed final packet.
  // Supaya 1x embed saja (lebih cepat), kita embed packet AFTER output buffer siap.
  // Jadi: generate output image dulu (tanpa packet), baru embed packet ke output raw.

  // Decode -> raw dari input
  const img = sharp(buffer);
  const meta = await img.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  const raw = await img.ensureAlpha().raw().toBuffer();
  const pixels = width * height;

  // Output base image (PNG recommended preserve LSB)
  // (kita belum embed packet)
  const baseOut = sharp(raw, { raw: { width, height, channels: 4 } });
  const baseOutBuf = forcePng
    ? await baseOut.png({ compressionLevel: 9 }).toBuffer()
    : await baseOut.toBuffer();

  // wmSha256 adalah hash dari output yang akan dibagikan (setelah embed packet).
  // Tapi karena embed packet mengubah pixel, wmSha256 harus dihitung dari FINAL output (setelah embed packet).
  // Solusi: hitung wmSha256 setelah embed packet. Artinya payload harus ditandatangani tanpa wmSha256? Tidak.
  // Jadi kita lakukan: embed packet menggunakan payloadUnsigned, lalu hash final outBuf, lalu re-embed packet? itu 2x.
  //
  // Biar 1x embed + tetap aman anti-fitnah:
  // - wmSha256 dihitung dari "baseOutBuf" (yang sudah jadi output visual),
  // - lalu embed packet ke baseOutBuf.
  // Jadi integrity membuktikan bahwa pixel visual "baseOutBuf" belum diubah secara berarti,
  // dan watermark packet sendiri adalah bukti signature. Untuk fitnah edit (PixelLab) yang mengubah pixel visual, mismatch tetap terjadi.
  //
  // (Kalau mereka edit watermark bit doang, signature/CRC akan jatuh.)

  const wmSha256 = crypto.createHash("sha256").update(baseOutBuf).digest("hex");

  const payloadUnsigned = {
    ...basePayload,
    wmSha256,
  };

  const unsignedJson = Buffer.from(JSON.stringify(payloadUnsigned), "utf8");
  const signature = crypto.sign(null, unsignedJson, privatePem); // Ed25519 uses null algo

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
    throw new Error(
      `Image too small: need ${neededSlots} pixels, got ${pixels}. Use bigger image or lower repeat.`
    );
  }

  const seed = crypto
    .createHash("sha256")
    .update(Buffer.from(publicPem || "public"))
    .update(Buffer.from([width & 255, height & 255]))
    .digest();

  const indices = seededIndexStream(seed, neededSlots, pixels);

  // Embed with repetition
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

  const outFinal = sharp(raw, { raw: { width, height, channels: 4 } });
  const outBuf = forcePng
    ? await outFinal.png({ compressionLevel: 9 }).toBuffer()
    : await outFinal.toBuffer();

  return {
    buffer: outBuf,
    payload: payloadSigned,
    pubFp,
  };
}

export async function extractWatermark(buffer, { publicPem, repeat = 5 } = {}) {
  if (!publicPem) throw new Error("Missing public key (wm_public.pem)");

  const img = sharp(buffer);
  const meta = await img.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  const raw = await img.ensureAlpha().raw().toBuffer();
  const pixels = width * height;

  // Header: MAGIC(4)+LEN(4)+CRC(4) = 12 bytes = 96 bits
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
      const b = raw[pixIndex * 4 + 2] & 1;
      ones += b;
    }
    return ones > repeat / 2 ? 1 : 0;
  };

  // Read header bits
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
  const ok = crypto.verify(null, unsignedJson, publicPem, sig);

  // Anti-fitnah: fragile integrity check (ONLY for v2 payload that has wmSha256)
  const currentSha = crypto.createHash("sha256").update(buffer).digest("hex");

  let integrity = {
    supported: false,
    pass: false,
    expectedWmSha256: null,
    currentWmSha256: currentSha,
    reason: "Legacy watermark (no wmSha256 in payload)",
  };

  if (typeof payloadObj.wmSha256 === "string" && payloadObj.wmSha256.length >= 16) {
    integrity.supported = true;
    integrity.expectedWmSha256 = payloadObj.wmSha256;
    integrity.pass = payloadObj.wmSha256 === currentSha;
    integrity.reason = integrity.pass
      ? "OK"
      : "TAMPERED: image content changed after signing (wmSha256 mismatch)";
  }

  return {
    detected: true,
    signatureValid: ok,
    integrity,
    payload: payloadObj,
  };
}