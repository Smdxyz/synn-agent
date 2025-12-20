import { downloadMedia } from "../../helper.js";
import { config } from "../../config.js";
import { loadKeys, embedWatermark } from "../../libs/wm/wm.core.js";

export default async function (sock, message, args, query, sender) {
  const creator = args[0] || config.botName || "unknown";

  const media = await downloadMedia({ message });
  if (!media?.buffer) {
    return sock.sendMessage(sender, { text: "Reply foto dulu, lalu ketik .wm <creator>" }, { quoted: message });
  }

  const { publicPem, privatePem } = loadKeys();
  const note = `bot=${config.botName};wm=${config.WATERMARK || ""}`; // 4

  const out = await embedWatermark(media.buffer, {
    creator,
    note,
    privatePem,
    publicPem,
    repeat: 5,
    forcePng: true, // penting biar watermark awet
  });

  const cap = `✅ WM embedded\ncreator: ${creator}\npubFp: ${out.pubFp}\n(ts signed)`;
  await sock.sendMessage(sender, { image: out.buffer, caption: cap }, { quoted: message });
}