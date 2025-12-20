// modules/security/wmcheck.js
import { downloadMedia } from "../../helper.js";
import { loadKeys, extractWatermark } from "../../libs/wm/wm.core.js";

/**
 * WA-safe labeling:
 * - ORIGINAL: signature valid + PASS
 * - REUPLOAD (RE-ENCODE): SOFT_FAIL without resize
 * - DERIVATIVE (RESIZED/UPSCALED): SOFT_FAIL with resize
 * - REUPLOAD (WA RE-ENCODE): FAIL but signature valid + no resize (common on WhatsApp pipelines)
 * - EDITED (TAMPERED): FAIL with resize OR signature invalid
 *
 * This avoids "too harsh" flags for WA re-encode that changes pixels slightly.
 */
function buildStatus(res) {
  const p = res?.payload || {};
  const i = res?.integrity || {};

  // Legacy watermark (no integrity signals)
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

  // If signature invalid, always be strict.
  if (!res?.signatureValid) {
    return {
      status: "INVALID SIGNATURE",
      detail: "Signature invalid. Treat as untrusted/forged or corrupted payload.",
    };
  }

  // PASS: exact pixel match
  if (i.level === "PASS") {
    if (resized) {
      return {
        status: "DERIVATIVE (RESIZED)",
        detail: `Size changed ${srcW}x${srcH} → ${curW}x${curH}, but pixel hash matched.`,
      };
    }
    return { status: "ORIGINAL", detail: "Pixel hash matched exactly." };
  }

  // SOFT_FAIL: tag matches, full hash differs (typical re-encode / minor transforms)
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

  // FAIL: tag mismatch
  // WhatsApp sometimes causes pixel-level differences even without edits.
  // WA-safe policy: if signature is valid AND there is NO resize, we label it as WA re-encode
  // instead of accusing tampering.
  if (i.level === "FAIL") {
    if (!resized) {
      return {
        status: "REUPLOAD (WA RE-ENCODE)",
        detail:
          "Signature valid and dimensions unchanged. WhatsApp pipelines may alter pixels subtly " +
          "during resend/preview. Marked as reupload instead of tampered.",
      };
    }

    return {
      status: "DERIVATIVE + EDITED",
      detail:
        `Size changed ${srcW}x${srcH} → ${curW}x${curH} AND pixel tag mismatch. ` +
        "This indicates resizing/upscaling + content edits (tampered).",
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
      `currentPixelSha256: ${
        i.currentPixelSha256 ? String(i.currentPixelSha256).slice(0, 16) + "…" : "-"
      }`;

    await sock.sendMessage(sender, { text }, { quoted: message });
  } catch (e) {
    await sock.sendMessage(
      sender,
      { text: `❌ WM CHECK FAILED: ${e?.message || e}` },
      { quoted: message }
    );
  }
}