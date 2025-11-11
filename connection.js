// connection.js (FINAL FIX - TARGETING RESTART REQUIRED ERROR)

import * as baileys from '@whiskeysockets/baileys';
import pino from "pino";
import { Boom } from "@hapi/boom";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

export async function connectToWhatsApp() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState("auth_info_baileys");
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "info" }),
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60_000, 
  });

  if (!sock.authState.creds.registered) {
    await new Promise(r => setTimeout(r, 1500));
    const phoneNumber = await question(
      "\nMasukkan nomor WhatsApp Anda (cth: 6281234567890): "
    );
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`\n================================\n Kode Pairing Anda: ${code}\n================================\n`);
    } catch (error) {
      console.error("Gagal meminta kode pairing:", error);
      process.exit(1);
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("\n✅ Koneksi berhasil tersambung! Bot siap digunakan.\n");
      if (!rl.closed) rl.close();
    } else if (connection === "close") {
      const error = lastDisconnect.error;
      const statusCode = (error instanceof Boom) ? error.output.statusCode : 500;

      const shouldReconnect = statusCode !== baileys.DisconnectReason.loggedOut;
      const reason = error ? error.message : 'Unknown Error';
      console.error(`🔌 Koneksi terputus. Alasan: ${reason}. Kode: ${statusCode}`);

      // Logika Final:
      // 1. Jika di-logout -> jangan restart (exit 0)
      if (statusCode === baileys.DisconnectReason.loggedOut) {
        console.log("❌ Perangkat Telah Keluar (Logout). Hapus 'auth_info_baileys' dan scan ulang. Bot tidak akan restart.");
        process.exit(0);
      }
      // 2. Jika server secara eksplisit minta restart (seperti kasus lu sekarang) -> WAJIB restart (exit 1)
      else if (statusCode === baileys.DisconnectReason.restartRequired) {
        console.log("🔥 Server meminta restart (Restart Required). Memulai restart penuh via PM2...");
        // Langsung exit(1) agar PM2 segera bertindak. Ini adalah tindakan yang benar untuk error ini.
        process.exit(1); 
      }
      // 3. Jika masalah lain (gangguan jaringan sementara, dll) -> JANGAN restart, biarkan Baileys mencoba lagi.
      else if (shouldReconnect) {
        console.log("♻️ Gangguan jaringan sementara, mencoba menyambung ulang...");
        // Kita tidak melakukan apa-apa, Baileys akan menangani ini.
        // Jika gagal terus-menerus, barulah mungkin perlu restart manual.
        // Tapi untuk sekarang, biarkan otomatis.
      }
    }
  });

  return sock;
}