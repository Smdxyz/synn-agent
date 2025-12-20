// libs/wm/png.meta.js
import extractChunks from "png-chunks-extract";
import encodeChunks from "png-chunks-encode";
import textChunk from "png-chunk-text";

/**
 * Add/replace tEXt chunks in a PNG.
 * Note: Many platforms strip metadata; this is a "signal + legal trail", not a hard block.
 */
export function addPngTextMetadata(pngBuffer, fields = {}) {
  const chunks = extractChunks(pngBuffer);

  // Remove existing tEXt keys we will re-add (prevent duplicates)
  const keys = new Set(Object.keys(fields));
  const filtered = chunks.filter((c) => {
    if (c.name !== "tEXt") return true;
    try {
      const decoded = textChunk.decode(c.data);
      return !keys.has(decoded.keyword);
    } catch {
      return true;
    }
  });

  // Insert text chunks right before IEND
  const out = [];
  for (const c of filtered) {
    if (c.name === "IEND") {
      // Add our metadata before IEND
      for (const [k, v] of Object.entries(fields)) {
        out.push({
          name: "tEXt",
          data: textChunk.encode(k, String(v)),
        });
      }
      out.push(c);
    } else {
      out.push(c);
    }
  }

  return Buffer.from(encodeChunks(out));
}

export function readPngTextMetadata(pngBuffer) {
  const chunks = extractChunks(pngBuffer);
  const meta = {};
  for (const c of chunks) {
    if (c.name !== "tEXt") continue;
    try {
      const { keyword, text } = textChunk.decode(c.data);
      meta[keyword] = text;
    } catch {
      // ignore
    }
  }
  return meta;
}

/**
 * Opinionated "NoAI + rights" profile.
 * You can tweak these values for your brand.
 */
export function buildNoAiRightsMeta({
  creator = "unknown",
  handle = "@szyrine",
  year = new Date().getFullYear(),
  license = "All Rights Reserved",
  contact = "",
  extra = "",
} = {}) {
  const rightsLine = `© ${year} ${creator} (${handle}). ${license}.`;

  // These are "signals". Some crawlers/tools recognize "noai"/"noimageai" conventions.
  return {
    Author: creator,
    Creator: creator,
    Copyright: rightsLine,
    License: license,
    Rights: rightsLine,
    Contact: contact || "DM owner",
    // Signals used in the wild (not universal)
    noai: "true",
    noimageai: "true",
    "do-not-train": "true",
    "ai-training-prohibited": "true",
    UsageTerms:
      "NO AI TRAINING / NO DATASET / NO REUPLOAD FOR ML. Editing allowed only with explicit written permission.",
    Notes: extra || "Provenance protected by cryptographic watermark + signature.",
  };
}