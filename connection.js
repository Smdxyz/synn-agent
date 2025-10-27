// connection.js (FINAL UPGRADE: SELF-HEALING RESTART VIA PM2 - MONITORING REMOVED)

import * as baileys from '@whiskeysockets/baileys';
import pino from "pino";
import { Boom } from "@hapi/boom";
import readline from "readline";
// import { onBotConnected, onBotDisconnected } from './monitoring.js'; // <-- DIHAPUS

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
      // onBotConnected(); // <-- DIHAPUS
      if (!rl.closed) rl.close();
    } else if (connection === "close") {
      // onBotDisconnected(); // <-- DIHAPUS

      const statusCode = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 500;
      
      const isLogout = statusCode === baileys.DisconnectReason.loggedOut;

      if (isLogout) {
        console.log("❌ Perangkat Telah Keluar (Logout). Hapus 'auth_info_baileys' dan scan ulang. Bot tidak akan restart.");
        process.exit(0);
      } else {
        const reason = lastDisconnect.error?.message || 'Unknown Error';
        console.error(`❌ Koneksi terputus secara fatal. Alasan: ${reason}. Kode: ${statusCode}`);
        console.log("🔥 Memulai restart penuh via PM2 dalam 5 detik...");
        
        setTimeout(() => process.exit(1), 5000); 
      }
    }
  });

  return sock;
}