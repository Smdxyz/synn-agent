// modules/tools/lirik.js
// Lirik berjalan (single line) + typewriter (dicicil) via edit-message
// Command:
//  - .lirik        -> start
//  - .lirik stop   -> stop/cancel (silent)

import H from "../../helper.js";

// ====== LIRIK JSON (base) ======
const LYRICS_JSON = `{
  "lyrics": [
    { "start": "00:04.000", "end": "00:07.000", "text": "Bersandar padaku" },
    { "start": "00:07.000", "end": "00:10.000", "text": "taruh di bahuku" },
    { "start": "00:10.000", "end": "00:13.000", "text": "Relakan semua" },
    { "start": "00:13.000", "end": "00:16.000", "text": "bebas semaumu" },
    { "start": "00:16.000", "end": "00:19.000", "text": "Percayalah ini" },
    { "start": "00:17.250", "end": "00:22.000", "text": "sayang terlewatkan" },
    { "start": "00:22.000", "end": "00:25.000", "text": "Ku sampaikan dalam nyanyian" },
    { "start": "00:25.000", "end": "00:29.000", "text": "Bergema sampai selamanya" }
  ]
}`;

// ====== PATCH KHUSUS (HANYA 2 BARIS YANG SALAH) ======
const PATCH = {
  "sayang terlewatkan": { start: "00:17.250", end: "00:22.000" },
  "Bergema sampai selamanya": { start: "00:25.000", end: "00:29.000" } // end dipastikan 29.000
};

// ====== TYPEWRITER SETTINGS ======
const MAX_EDITS_PER_LINE = 18;  // biar gak kebanyakan edit (anti rate-limit)
const MIN_STEP_MS = 110;        // minimal jarak antar edit
const TYPE_PORTION = 0.65;      // 65% durasi dipakai buat “ngetik”, sisanya hold

// ====== STATE ======
const running = new Map(); // senderJid -> { cancelled:boolean, key:any }

function timeToMs(t) {
  const parts = String(t).split(":");
  let h = 0, m = 0, sMs = "0";
  if (parts.length === 2) {
    m = Number(parts[0]) || 0;
    sMs = parts[1];
  } else {
    h = Number(parts[0]) || 0;
    m = Number(parts[1]) || 0;
    sMs = parts[2];
  }
  const [sStr, msStr = "0"] = sMs.split(".");
  const s = Number(sStr) || 0;
  const ms = Number(msStr.padEnd(3, "0").slice(0, 3)) || 0;
  return (((h * 60 + m) * 60) + s) * 1000 + ms;
}

// drift-correct wait until absolute ms since t0
async function waitUntil(t0, targetMs, ctrl) {
  while (true) {
    if (ctrl?.cancelled) return false;
    const now = Date.now() - t0;
    const remain = targetMs - now;
    if (remain <= 0) return true;
    await H.delay(Math.min(remain, remain > 90 ? 45 : remain));
  }
}

function applyPatch(item) {
  const p = PATCH[item.text];
  if (!p) return item;
  return {
    ...item,
    start: p.start ?? item.start,
    end: p.end ?? item.end
  };
}

// typewriter: “dicicil” jadi beberapa edit (bukan per-huruf beneran 1:1 biar aman rate limit)
async function typewriterLine(sock, jid, key, text, t0, startMs, endMs, ctrl) {
  const duration = Math.max(0, endMs - startMs);
  if (duration <= 0) return;

  // porsi buat mengetik
  const typingMs = Math.max(
    260,
    Math.min(4000, Math.floor(duration * TYPE_PORTION))
  );

  // tentuin steps yang aman
  const byTime = Math.max(1, Math.floor(typingMs / MIN_STEP_MS));
  const byChars = Math.max(1, Math.min(text.length, MAX_EDITS_PER_LINE));
  const steps = Math.max(1, Math.min(byTime, byChars));

  // mulai: pastiin kosong dulu (biar efek masuk)
  await sock.sendMessage(jid, { text: " " }).catch(() => {});
  await H.editMessage(sock, jid, " ", key);

  // ketik bertahap
  for (let i = 1; i <= steps; i++) {
    if (ctrl.cancelled) return;

    const at = startMs + Math.floor((i * typingMs) / steps);
    const ok = await waitUntil(t0, at, ctrl);
    if (!ok || ctrl.cancelled) return;

    const cut = Math.ceil((i / steps) * text.length);
    const chunk = text.slice(0, cut);

    await H.editMessage(sock, jid, chunk, key);
  }

  // hold full sampai end
  const ok2 = await waitUntil(t0, endMs, ctrl);
  if (!ok2 || ctrl.cancelled) return;

  // bersihin setelah selesai baris (biar “hilang”)
  await H.editMessage(sock, jid, " ", key);
}

export default async function lirikModule(sock, m, args, q, sender) {
  const sub = (args?.[0] || "").toLowerCase();

  // STOP (silent, gak ngubah pesan)
  if (["stop", "off", "cancel"].includes(sub)) {
    const st = running.get(sender);
    if (st) st.cancelled = true;
    return;
  }

  // anti double run
  if (running.has(sender) && running.get(sender)?.cancelled === false) return;

  let parsed;
  try {
    parsed = JSON.parse(LYRICS_JSON);
  } catch (e) {
    return sock.sendMessage(sender, { text: `JSON lirik invalid: ${e.message}` }, { quoted: m });
  }

  const baseLines = Array.isArray(parsed?.lyrics) ? parsed.lyrics : [];
  const timeline = baseLines
    .map((x) => ({ start: x.start, end: x.end, text: String(x.text ?? "").trim() }))
    .filter((x) => x.text.length > 0)
    .map(applyPatch) // <-- patch cuma 2 baris
    .map((x) => ({
      startMs: timeToMs(x.start),
      endMs: timeToMs(x.end),
      text: x.text
    }))
    .sort((a, b) => a.startMs - b.startMs);

  if (!timeline.length) {
    return sock.sendMessage(sender, { text: "Lirik kosong / tidak valid." }, { quoted: m });
  }

  // kirim placeholder sekali, abis itu cuma edit message itu
  const sent = await sock.sendMessage(sender, { text: " " }, { quoted: m });
  const ctrl = { cancelled: false, key: sent.key };
  running.set(sender, ctrl);

  const t0 = Date.now();

  try {
    for (const line of timeline) {
      if (ctrl.cancelled) break;
      const startMs = Math.max(0, line.startMs);
      const endMs = Math.max(startMs + 1, line.endMs);

      // tunggu start baris
      const ok = await waitUntil(t0, startMs, ctrl);
      if (!ok || ctrl.cancelled) break;

      // typewriter tampil sampai end
      await typewriterLine(sock, sender, ctrl.key, line.text, t0, startMs, endMs, ctrl);
    }
  } catch (e) {
    await sock.sendMessage(sender, { text: `Error lirik: ${e.message}` }, { quoted: m });
  } finally {
    running.delete(sender);
  }
}

export const cost = 1;
