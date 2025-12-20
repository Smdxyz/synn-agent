// modules/security/wm.js
import { downloadMedia } from "../../helper.js";
import { config } from "../../config.js";
import { loadKeys, embedWatermark } from "../../libs/wm/wm.core.js";

export default async function (sock, message, args, query, sender) {
  try {
    const creator = (args?.[0] || config.botName || "unknown").trim();
    const media = await downloadMedia(message);

    if (!media?.buffer) {
      return sock.sendMessage(
        sender,
        { text: "Reply foto dulu, lalu ketik .wm <creator>\nContoh: .wm Sann" },
        { quoted: message }
      );
    }

    const { publicPem, privatePem, pubFp } = loadKeys();

    const out = await embedWatermark(media.buffer, {
      creator,
      note: `bot=${config.botName || "-"};mode=wm`,
      privatePem,
      publicPem,
      repeat: 5,
      forcePng: true,
    });

    const caption =
      `✅ WM embedded\n` +
      `creator: ${creator}\n` +
      `pubFp: ${pubFp}\n` +
      `ts (signed): ${out.payload.ts}`;

    await sock.sendMessage(
      sender,
      { image: out.buffer, caption },
      { quoted: message }
    );
  } catch (e) {
    await sock.sendMessage(
      sender,
      { text: `❌ WM error: ${e.message}` },
      { quoted: message }
    );
  }
}