// modules/security/wmcheck.js
import { downloadMedia } from "../../helper.js";
import { loadKeys, extractWatermark } from "../../libs/wm/wm.core.js";

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

    const p = res.payload || {};
    const i = res.integrity || {};

    const integrityLine = i.supported
      ? `contentIntegrity: ${i.pass ? "PASS" : "FAIL"}\nreason: ${i.reason}`
      : `contentIntegrity: N/A\nreason: ${i.reason || "legacy watermark"}`;

    const text =
      `🔎 WM CHECK\n` +
      `detected: YES\n` +
      `signatureValid: ${res.signatureValid ? "YES" : "NO"}\n` +
      `${integrityLine}\n\n` +
      `creator: ${p.creator}\n` +
      `ts: ${p.ts}\n` +
      `pubFp (key): ${pubFp}\n` +
      `pubFp (payload): ${p.pubFp}\n` +
      `nonce: ${p.nonce}\n` +
      `srcSha256: ${p.srcSha256?.slice(0, 16)}…\n` +
      `wmSha256 (payload): ${p.wmSha256?.slice(0, 16)}…\n` +
      `wmSha256 (current): ${i.currentWmSha256?.slice(0, 16)}…`;

    await sock.sendMessage(sender, { text }, { quoted: message });
  } catch (e) {
    await sock.sendMessage(
      sender,
      { text: `❌ WM CHECK FAILED: ${e.message}` },
      { quoted: message }
    );
  }
}