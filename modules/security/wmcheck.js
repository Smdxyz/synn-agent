// modules/security/wmcheck.js
import { downloadMedia } from "../../helper.js";
import { loadKeys, extractWatermark } from "../../libs/wm/wm.core.js";

function buildStatus(res) {
  const p = res?.payload || {};
  const i = res?.integrity || {};

  // Legacy watermark (no integrity info)
  if (!i.supported) {
    return {
      status: "LEGACY",
      detail: i.reason || "Legacy watermark: no integrity signals available.",
    };
  }

  const srcW = Number(p.srcW || 0);
  const srcH = Number(p.srcH || 0);
  const curW = Number(i.currentW || 0);
  const curH = Number(i.currentH || 0);

  const hasDims = srcW > 0 && srcH > 0 && curW > 0 && curH > 0;
  const resized = hasDims && (srcW !== curW || srcH !== curH);

  // PASS: pixel hash exact match
  if (i.level === "PASS") {
    if (resized) {
      // Rare, but if happens: pixels match but dims differ means weird pipeline.
      return {
        status: "DERIVATIVE (RESIZED)",
        detail: `Size changed ${srcW}x${srcH} → ${curW}x${curH}, but pixel hash matched.`,
      };
    }
    return {
      status: "ORIGINAL",
      detail: "Pixel hash matched exactly.",
    };
  }

  // SOFT_FAIL: tag match, full hash differs (likely re-encode/reupload)
  if (i.level === "SOFT_FAIL") {
    if (resized) {
      return {
        status: "DERIVATIVE (RESIZED/UPSCALED)",
        detail:
          `Likely resize/upscale/downscale. Size ${srcW}x${srcH} → ${curW}x${curH}. ` +
          "Pixel tag matched (same content identity), but pixels differ due to transform.",
      };
    }
    return {
      status: "REUPLOAD (RE-ENCODE)",
      detail:
        "Pixel tag matched (same content identity), but full pixel hash differs (likely save ulang / re-encode).",
    };
  }

  // FAIL: pixel tag mismatch (real edits / different content)
  if (i.level === "FAIL") {
    if (resized) {
      return {
        status: "DERIVATIVE + EDITED",
        detail:
          `Size changed ${srcW}x${srcH} → ${curW}x${curH} AND pixel tag mismatch. ` +
          "This indicates resizing/upscaling + content edits (tampered).",
      };
    }
    return {
      status: "EDITED (TAMPERED)",
      detail: "Pixel tag mismatch: content edited/different after signing.",
    };
  }

  return {
    status: "UNKNOWN",
    detail: i.reason || "Unknown integrity state.",
  };
}

export default async function (sock, message, args, query, sender) {
  try {
    const media = await downloadMedia(message);

    if (!media?.buffer) {
      return sock.sendMessage(
        sender,
        { text: "Reply foto dulu, lalu ketik .wmcheck" },
        { quoted: message }
      );
    }

    const { publicPem, pubFp } = loadKeys();

    const res = await extractWatermark(media.buffer, {
      publicPem,
      repeat: 5,
    });

    const p = res?.payload || {};
    const i = res?.integrity || {};
    const st = buildStatus(res);

    const dimsLine =
      p.srcW && p.srcH && i.currentW && i.currentH
        ? `size: ${p.srcW}x${p.srcH} → ${i.currentW}x${i.currentH}`
        : "size: -";

    const text =
      `🔎 WM CHECK\n` +
      `detected: YES\n` +
      `signatureValid: ${res?.signatureValid ? "YES" : "NO"}\n` +
      `status: ${st.status}\n` +
      `${dimsLine}\n` +
      `detail: ${st.detail}\n\n` +
      `creator: ${p.creator || "-"}\n` +
      `ts: ${p.ts || "-"}\n` +
      `pubFp (key): ${pubFp}\n` +
      `pubFp (payload): ${p.pubFp || "-"}\n` +
      `nonce: ${p.nonce || "-"}\n` +
      `integrityLevel: ${i.level || "N/A"}\n` +
      `reason: ${i.reason || "-"}\n` +
      `srcPixelSha256: ${p.srcPixelSha256 ? String(p.srcPixelSha256).slice(0, 16) + "…" : "-"}\n` +
      `currentPixelSha256: ${i.currentPixelSha256 ? String(i.currentPixelSha256).slice(0, 16) + "…" : "-"}`;

    await sock.sendMessage(sender, { text }, { quoted: message });
  } catch (e) {
    await sock.sendMessage(
      sender,
      { text: `❌ WM CHECK FAILED: ${e?.message || e}` },
      { quoted: message }
    );
  }
}