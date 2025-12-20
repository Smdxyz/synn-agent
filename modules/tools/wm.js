// modules/security/wm.js
import { downloadMedia } from "../../helper.js";
import { config } from "../../config.js";
import { loadKeys, embedWatermark } from "../../libs/wm/wm.core.js";

export default async function (sock, message, args, query, sender) {
  try {
    const creator = (args?.[0] || config.botName || "unknown").trim();

    // ✅ PENTING: helper lu expect "message" langsung, BUKAN { message }
    const media = await downloadMedia(message);

    if (!media?.buffer) {
      return sock.sendMessage(
        sender,
        { text: "Reply foto dulu, lalu ketik .wm <creator>\nContoh: .wm Sann" },
        { quoted: message }
      );
    }

    const { publicPem, privatePem, pubFp } = loadKeys({
      privatePemPath: "wm_private.pem",
      publicPemPath: "wm_public.pem",
    });

    const note = `bot=${config.botName || "-"};wm=${config.WATERMARK || "-"}`;

    // Embed invisible signed WM (PNG supaya awet)
    const out = await embedWatermark(media.buffer, {
      creator,
      note,
      privatePem,
      publicPem,
      repeat: 5,
      forcePng: true,
    });

    const cap =
      `✅ WM embedded\n` +
      `creator: ${creator}\n` +
      `pubFp: ${pubFp}\n` +
      `ts (signed): ${out.payload?.ts || "-"}\n` +
      `note: ${note}`;

    await sock.sendMessage(
      sender,
      { image: out.buffer, caption: cap },
      { quoted: message }
    );
  } catch (e) {
    await sock.sendMessage(
      sender,
      { text: `❌ WM error: ${e?.message || e}` },
      { quoted: message }
    );
  }
}