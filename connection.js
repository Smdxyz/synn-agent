// connection.js (BACK TO YOUR ORIGINAL CODE, WITH ONE TINY LOGIC FIX)

import * as baileys from '@whiskeysockets/baileys';
import pino from "pino";
import { Boom } from "@hapi/boom";
import readline from "readline";
// import { onBotConnected, onBotDisconnected } from './monitoring.js'; // <-- DIHAPUS (Sesuai kode asli lu)

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
    logger: pino({ level: "info" }), // DIJAMIN GAK DIUBAH, BIAR PAIRING JALAN
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60_000, 
  });

  // Bagian pairing code ini sama persis kayak punya lu, gak disentuh.
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


  // =========================================================================
  // ========= INI SATU-SATUNYA BAGIAN YANG DIUBAH DARI KODE ASLI LU =========
  // =========================================================================
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("\n✅ Koneksi berhasil tersambung! Bot siap digunakan.\n");
      if (!rl.closed) rl.close();
    } else if (connection === "close") {
      const error = lastDisconnect.error;
      const statusCode = (error instanceof Boom) ? error.output.statusCode : 500;

      // Logika Kapan Harus Diem dan Kapan Harus Restart:
      // 1. Kalo di-logout, ya udah mati aja. Gak usah restart. (Ini udah bener dari awal)
      if (statusCode === baileys.DisconnectReason.loggedOut) {
        console.log("❌ Perangkat Telah Keluar (Logout). Hapus 'auth_info_baileys' dan scan ulang. Bot tidak akan restart.");
        process.exit(0); // Exit 0, PM2 gak akan restart.
      } 
      // 2. Kalo "stream error", "connection lost", dll. INI KUNCINYA: JANGAN NGAPA-NGAPAIN.
      //    Biarkan Baileys mencoba menyambung ulang sendiri. Kode asli lu langsung `exit(1)`.
      //    Kita cuma kasih log aja sekarang.
      else {
          const reason = error ? error.message : 'Unknown Error';
          console.error(`🔌 Koneksi terputus. Alasan: ${reason}. Kode: ${statusCode}`);
          console.log("♻️ Ini mungkin hanya gangguan jaringan. Baileys akan mencoba menyambung ulang secara otomatis. Mohon tunggu...");
          // TIDAK ADA `process.exit(1)` DI SINI. INI YANG BIKIN BEDA.
          // Jika Baileys benar-benar gagal total, PM2 akan mendeteksinya sebagai crash dan merestart.
          // Tapi untuk gangguan sesaat, dia akan diam dan pulih sendiri.
      }
    }
  });
  // =========================================================================
  // ====================== AKHIR DARI BAGIAN YANG DIUBAH ======================
  // =========================================================================

  return sock;
}