// modules/security/wmmeta.js
import { downloadMedia } from "../../helper.js";
import { config } from "../../config.js";
import { loadKeys, embedWatermark } from "../../libs/wm/wm.core.js";
import {
  addPngTextMetadata,
  buildNoAiRightsMeta,
} from "../../libs/wm/png.meta.js";

export default async function (sock, message, args, query, sender) {
  try {
    const creator = (args?.[0] || config.botName || "unknown").trim();
    const media = await downloadMedia(message);

    if (!media?.buffer) {
      return sock.sendMessage(
        sender,
        { text: "Reply foto dulu, lalu ketik .wmmeta <creator>" },
        { quoted: message }
      );
    }

    const { publicPem, privatePem, pubFp } = loadKeys();

    // 1) embed cryptographic watermark
    const out = await embedWatermark(media.buffer, {
      creator,
      note: `bot=${config.botName || "-"};mode=wmmeta`,
      privatePem,
      publicPem,
      repeat: 5,
      forcePng: true,
    });

    // 2) add NoAI metadata
    const meta = buildNoAiRightsMeta({
      creator,
      handle: config.WATERMARK || "@szyrine",
      contact: config.OWNER_NUMBER
        ? `wa:${config.OWNER_NUMBER}`
        : "",
      extra: `pubFp=${pubFp}`,
    });

    const finalBuf = addPngTextMetadata(out.buffer, meta);

    const caption =
      `✅ WM + NoAI META\n` +
      `creator: ${creator}\n` +
      `pubFp: ${pubFp}\n` +
      `Note: metadata bisa dihapus platform`;

    await sock.sendMessage(
      sender,
      { image: finalBuf, caption },
      { quoted: message }
    );
  } catch (e) {
    await sock.sendMessage(
      sender,
      { text: `❌ wmmeta error: ${e.message}` },
      { quoted: message }
    );
  }
}