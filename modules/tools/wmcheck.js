// modules/security/wmcheck.js
import { downloadMedia } from "../../helper.js";
import { loadKeys, extractWatermark } from "../../libs/wm/wm.core.js";

export default async function (sock, message, args, query, sender) {
  try {
    // ✅ PENTING: helper lu expect "message" langsung, BUKAN { message }
    const media = await downloadMedia(message);

    if (!media?.buffer) {
      return sock.sendMessage(
        sender,
        { text: "Reply foto dulu, lalu ketik .wmcheck" },
        { quoted: message }
      );
    }

    const { publicPem, pubFp } = loadKeys({
      privatePemPath: "wm_private.pem",
      publicPemPath: "wm_public.pem",
    });

    const res = await extractWatermark(media.buffer, {
      publicPem,
      repeat: 5,
    });

    const p = res?.payload || {};
    const text =
      `🔎 WM CHECK\n` +
      `detected: ${res?.detected ? "YES" : "NO"}\n` +
      `signatureValid: ${res?.signatureValid ? "YES" : "NO"}\n` +
      `\n` +
      `creator: ${p.creator || "-"}\n` +
      `ts: ${p.ts || "-"}\n` +
      `pubFp (from key): ${pubFp}\n` +
      `pubFp (from payload): ${p.pubFp || "-"}\n` +
      `nonce: ${p.nonce || "-"}\n` +
      `contentSha256: ${p.contentSha256 ? String(p.contentSha256).slice(0, 16) + "…" : "-"}\n` +
      `note: ${p.note || "-"}`;

    await sock.sendMessage(sender, { text }, { quoted: message });
  } catch (e) {
    await sock.sendMessage(
      sender,
      { text: `❌ No valid WM: ${e?.message || e}` },
      { quoted: message }
    );
  }
}