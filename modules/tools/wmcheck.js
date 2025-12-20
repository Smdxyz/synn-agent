import { downloadMedia } from "../../helper.js";
import { loadKeys, extractWatermark } from "../../libs/wm/wm.core.js";

export default async function (sock, message, args, query, sender) {
  const media = await downloadMedia({ message });
  if (!media?.buffer) {
    return sock.sendMessage(sender, { text: "Reply foto dulu, lalu ketik .wmcheck" }, { quoted: message });
  }

  try {
    const { publicPem } = loadKeys();
    const res = await extractWatermark(media.buffer, { publicPem, repeat: 5 });

    const p = res.payload || {};
    const text =
      `🔎 WM DETECTED: ${res.detected}\n` +
      `✅ Signature valid: ${res.signatureValid}\n` +
      `creator: ${p.creator || "-"}\n` +
      `ts: ${p.ts || "-"}\n` +
      `pubFp: ${p.pubFp || "-"}\n` +
      `nonce: ${p.nonce || "-"}\n`;

    return sock.sendMessage(sender, { text }, { quoted: message });
  } catch (e) {
    return sock.sendMessage(sender, { text: `❌ No valid WM: ${e.message}` }, { quoted: message });
  }
}