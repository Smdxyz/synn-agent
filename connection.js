// connection.js (YOUR ORIGINAL CODE + THE SMALLEST POSSIBLE FIX)

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
    logger: pino({ level: "info" }), // LOGGER ASLI, TIDAK DIUBAH SAMA SEKALI
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60000, 
  });

  // KODE PAIRING ASLI LU, TIDAK DISENTUH
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
      const statusCode = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 500;
      
      const isLogout = statusCode === baileys.DisconnectReason.loggedOut;
      const isRestartRequired = statusCode === baileys.DisconnectReason.restartRequired;

      if (isLogout) {
        console.log("❌ Perangkat Telah Keluar (Logout). Hapus 'auth_info_baileys' dan scan ulang. Bot tidak akan restart.");
        process.exit(0);
      } 
      // JIKA SERVER MINTA RESTART (KASUS LU), ATAU ADA ERROR FATAL LAINNYA, BARU KITA RESTART
      else if (isRestartRequired) {
        const reason = lastDisconnect.error?.message || 'Restart Required';
        console.error(`❌ Koneksi terputus. Alasan: ${reason}. Kode: ${statusCode}`);
        console.log("🔥 Server meminta restart, memulai restart penuh via PM2...");
        process.exit(1);
      }
      // UNTUK SEMUA MASALAH LAIN (STREAM ERROR BIASA, KONEKSI PUTUS SESAAT), KITA DIAMKAN.
      else {
        const reason = lastDisconnect.error?.message || 'Unknown Network Error';
        console.log(`🔌 Koneksi terputus sementara (${reason}). Baileys akan mencoba menyambung ulang otomatis.`);
      }
    }
  });

  return sock;
}