import fs from "fs";
import path from "path";

const LOG_PATH = path.resolve("./data/qris_log.jsonl");

export const aliases = ["qrislog", "qlog"];

export default async function qrislog(sock, message, args, query, sender) {
  const limit = Math.min(Math.max(parseInt(args?.[0] || "10", 10), 1), 50);

  if (!fs.existsSync(LOG_PATH)) {
    return sock.sendMessage(sender, { text: "Belum ada log. Bikin nominal dulu: `.qriscreate 5000 10m`" }, { quoted: message });
  }

  const lines = fs.readFileSync(LOG_PATH, "utf8").trim().split("\n").filter(Boolean);
  const last = lines.slice(-limit).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);

  const now = Date.now();
  const out = last.map((x, i) => {
    const exp = x.expires_at ? Date.parse(x.expires_at) : null;
    const status = exp ? (now > exp ? "EXPIRED" : "ACTIVE") : "-";
    return [
      `#${last.length - i}`,
      `• waktu: ${x.ts}`,
      `• mode: ${x.mode}`,
      `• amount: ${x.amount ?? "-"}`,
      `• exp: ${x.expires_at ?? "-"}`,
      `• status: ${status}`,
      `• crc: ${x.crc ?? "-"}`,
    ].join("\n");
  }).join("\n\n");

  return sock.sendMessage(sender, { text: `🧾 *QRIS LOG* (last ${last.length})\n\n${out}` }, { quoted: message });
}