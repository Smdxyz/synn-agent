// connection.js (REVISED: SMART RECONNECT LOGIC)

import * as baileys from '@whiskeysockets/baileys';
import pino from "pino";
import { Boom } from "@hapi/boom";
import readline from "readline";

const { DisconnectReason } = baileys; // <-- PENTING: Ambil DisconnectReason

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Fungsi startSocket dipisah agar bisa dipanggil ulang untuk rekoneksi
async function startSocket() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState("auth_info_baileys");
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }), // Ubah ke 'info' jika butuh debug detail
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60_000,
    // Tambahkan browser agar lebih stabil
    browser: ['My-Bot', 'Chrome', '1.0.0']
  });

  // Logika pairing/scan QR
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
      // Restart jika gagal, mungkin ada masalah jaringan awal
      console.log("🔥 Gagal pairing, mencoba restart dalam 5 detik...");
      setTimeout(() => process.exit(1), 5000);
    }
  }

  sock.ev.on("creds.update", saveCreds);

  // LOGIKA UTAMA ADA DI SINI
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("\n✅ Koneksi berhasil tersambung! Bot siap digunakan.\n");
      if (!rl.closed) rl.close();
    } else if (connection === "close") {
      const statusCode = (lastDisconnect.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode
        : 500;
        
      const reason = lastDisconnect.error?.message || 'Unknown Error';
      console.warn(`🔌 Koneksi terputus. Alasan: "${reason}" (Kode: ${statusCode})`);

      // Logika Kapan Harus Restart vs Kapan Harus Coba Lagi
      // DisconnectReason.loggedOut -> Ini fatal, session hilang, harus scan ulang.
      if (statusCode === DisconnectReason.loggedOut) {
        console.error("❌ Perangkat Telah Keluar (Logout). Hapus folder 'auth_info_baileys' dan jalankan ulang untuk scan QR/pairing.");
        // Keluar dengan kode 0, PM2 tidak akan restart.
        process.exit(0); 
      } 
      // DisconnectReason.restartRequired -> Server WA menyuruh kita restart.
      else if (statusCode === DisconnectReason.restartRequired) {
        console.log("🔥 Server meminta restart, memulai ulang koneksi...");
        // Cukup panggil ulang fungsi koneksi, tidak perlu exit proses
        startSocket();
      }
      // DisconnectReason.timedOut, connectionLost, dll -> Ini masalah jaringan biasa.
      // Baileys akan otomatis mencoba menyambung ulang. Kita tidak perlu melakukan apa-apa.
      // Cukup beri jeda dan biarkan Baileys bekerja. Jika gagal terus, PM2 akan restart.
      else {
        console.log("♻️ Mencoba menyambungkan kembali...");
        // Di sini kita tidak melakukan `process.exit(1)`.
        // Kita biarkan Baileys menangani rekoneksi secara internal.
        // Jika Baileys gagal total setelah beberapa kali percobaan,
        // error lain mungkin akan muncul dan baru kita tangani.
        // Untuk sekarang, pendekatan paling stabil adalah membiarkannya.
      }
    }
  });

  return sock;
}


// Ubah fungsi connectToWhatsApp menjadi pembungkus untuk startSocket
export async function connectToWhatsApp() {
    try {
        const sock = await startSocket();
        return sock;
    } catch (error) {
        console.error("❌ Terjadi kesalahan fatal saat memulai bot:", error);
        console.log("🔥 Memulai restart penuh via PM2 dalam 10 detik...");
        setTimeout(() => process.exit(1), 10000); // Restart jika ada error tak terduga
    }
}