// connection.js (MINIMAL FIX BASED ON YOUR ORIGINAL FILE)

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
    // KITA KEMBALIKAN LOGGER SEPERTI ASLINYA, INI PENTING UNTUK PAIRING
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
      process.exit(1); // Jika gagal pairing di awal, restart saja
    }
  }

  sock.ev.on("creds.update", saveCreds);

  // ==================================================================
  // ========= PERUBAHAN UTAMA HANYA DI BLOK DI BAWAH INI =============
  // ==================================================================
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("\n✅ Koneksi berhasil tersambung! Bot siap digunakan.\n");
      if (!rl.closed) rl.close();
    } else if (connection === "close") {
      const statusCode = (lastDisconnect.error instanceof Boom) 
        ? lastDisconnect.error.output.statusCode 
        : 500;

      // Logika yang diperbaiki:
      // 1. Jika di-logout, ini fatal. Keluar dan jangan restart.
      if (statusCode === baileys.DisconnectReason.loggedOut) {
        console.log("❌ Perangkat Telah Keluar (Logout). Hapus 'auth_info_baileys' dan scan ulang. Bot tidak akan restart.");
        process.exit(0); // Keluar dengan kode 0 agar PM2 tidak restart
      } 
      // 2. Jika masalah lain (stream error, connection lost, dll), JANGAN LANGSUNG EXIT.
      //    Biarkan Baileys mencoba menyambung ulang sendiri.
      //    Kita hanya perlu memanggil ulang fungsi koneksi jika diperlukan, 
      //    atau biarkan saja untuk gangguan ringan.
      else {
        const reason = lastDisconnect.error?.message || 'Unknown Error';
        console.error(`🔌 Koneksi terputus. Alasan: ${reason}.`);
        console.log(`♻️ Mencoba menyambung kembali...`);
        // Memanggil kembali fungsi utama untuk mencoba konek lagi,
        // ini jauh lebih baik daripada mematikan seluruh proses dengan process.exit(1).
        connectToWhatsApp();
      }
    }
  });
  // ==================================================================
  // ================== AKHIR DARI BLOK PERUBAHAN =====================
  // ==================================================================

  return sock;
}