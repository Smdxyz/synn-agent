// modules/security/metacheck.js
import { downloadMedia } from "../../helper.js";
import { readPngTextMetadata } from "../../libs/wm/png.meta.js";

export default async function (sock, message, args, query, sender) {
  try {
    const media = await downloadMedia(message);

    if (!media?.buffer) {
      return sock.sendMessage(
        sender,
        { text: "Reply PNG dulu, lalu ketik .metacheck" },
        { quoted: message }
      );
    }

    const meta = readPngTextMetadata(media.buffer);
    const keys = Object.keys(meta);

    if (!keys.length) {
      return sock.sendMessage(
        sender,
        { text: "❌ Tidak ada metadata tEXt (mungkin sudah di-strip)." },
        { quoted: message }
      );
    }

    const show = (k) => (meta[k] ? `${k}: ${meta[k]}` : null);

    const text = [
      "🔎 PNG META CHECK",
      show("Author"),
      show("Copyright"),
      show("License"),
      show("noai"),
      show("noimageai"),
      show("do-not-train"),
      show("UsageTerms"),
      show("Notes"),
    ]
      .filter(Boolean)
      .join("\n");

    await sock.sendMessage(sender, { text }, { quoted: message });
  } catch (e) {
    await sock.sendMessage(
      sender,
      { text: `❌ metacheck error: ${e.message}` },
      { quoted: message }
    );
  }
}