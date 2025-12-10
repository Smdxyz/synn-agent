// connection.js — FINAL AGGRESSIVE RESTART VERSION

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
    // Gunakan 'silent' untuk production agar log bersih, atau 'error' untuk debug kritikal
    logger: pino({ level: "silent" }), 
    
    // Set timeout lebih pendek agar tidak menggantung terlalu lama saat error
    keepAliveIntervalMs: 10000, 
    emitOwnEvents: true,
    retryRequestDelayMs: 250,
    
    // Browser identity membantu stabilitas koneksi
    browser: ["Synn Agent", "Chrome", "20.0.04"], 
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
      throw new Error("Pairing failed");
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === "open") {
      console.log("\n✅ [STATUS] Koneksi Tersambung! Bot siap.");
    } 
    
    else if (connection === "close") {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      
      // Jika errornya bukan Boom standard, ambil message-nya
      if (!reason && lastDisconnect?.error) {
          reason = lastDisconnect.error.message || "Unknown Error";
      }

      // === PENANGANAN BERBAGAI STATUS CODE ===
      
      // 1. KASUS LOGOUT (Sesi Dihapus/Tidak Valid)
      if (reason === baileys.DisconnectReason.loggedOut) {
        console.error(`❌ [FATAL] Perangkat Logout. Hapus folder 'auth_info_baileys' dan scan ulang.`);
        // Emit logout agar bot.js berhenti total
        sock.ev.emit('connection.logout', new Error("Logged Out"));
      } 
      
      // 2. KASUS RESTART REQUIRED (Biasanya 415)
      else if (reason === baileys.DisconnectReason.restartRequired) {
        console.log("🔄 [INFO] Server meminta restart session.");
        sock.ev.emit('connection.restart', new Error("Restart Required"));
      }

      // 3. KASUS SEMUA ERROR LAIN (428, 408, 500, 515, Stream Error, dll)
      else {
        console.warn(`⚠️ [DISCONNECT] Terputus. Code: ${reason}. Memulai ulang koneksi...`);
        // Kita paksa RESTART untuk semua jenis error ini agar socket dibersihkan total
        sock.ev.emit('connection.restart', new Error(`Auto Restart (Code: ${reason})`));
      }
    }
  });

  return sock;
}