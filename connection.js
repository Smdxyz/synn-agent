// connection.js (FINAL REVISION: PAIRING & RECONNECT FIX)

import * as baileys from '@whiskeysockets/baileys';
import pino from "pino";
import { Boom } from "@hapi/boom";
import readline from "readline";

const { DisconnectReason, fetchLatestBaileysVersion, makeWASocket, useMultiFileAuthState } = baileys;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();
  console.log(`Menggunakan Baileys versi: ${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    // KEMBALIKAN LOGGER KE 'info' AGAR PAIRING BERFUNGSI
    logger: pino({ level: "info" }), 
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60_000,
    browser: ['My-Bot', 'Chrome', '1.0.0']
  });

  if (!sock.authState.creds.registered) {
    console.log("Sesi tidak ditemukan, memulai proses pairing...");
    await new Promise(r => setTimeout(r, 1500));
    
    const phoneNumber = await question(
      "\nMasukkan nomor WhatsApp Anda (cth: 6281234567890): "
    );
    
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`\n================================\n Kode Pairing Anda: ${code}\n================================\n`);
      console.log("Silakan buka WhatsApp di HP Anda dan masukkan kode di atas pada notifikasi 'Tautkan Perangkat'.");
    } catch (error) {
      console.error("Gagal meminta kode pairing:", error);
      console.log("🔥 Gagal pairing, mencoba restart dalam 5 detik...");
      setTimeout(() => process.exit(1), 5000);
      return null; // Hentikan eksekusi jika gagal
    }
  }

  sock.ev.on("creds.update", saveCreds);

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

      if (statusCode === DisconnectReason.loggedOut) {
        console.error("❌ Perangkat Telah Keluar (Logout). Hapus folder 'auth_info_baileys' dan jalankan ulang untuk pairing.");
        process.exit(0);
      } else if (statusCode === DisconnectReason.restartRequired) {
        console.log("🔥 Server meminta restart, memulai ulang koneksi...");
        connectToWhatsApp(); // Memanggil fungsi utama untuk rekoneksi penuh
      } else {
        console.log("♻️ Mencoba menyambungkan kembali... (Gangguan jaringan biasa, Baileys akan menangani ini)");
      }
    }
  });

  return sock;
}

export async function connectToWhatsApp() {
    try {
        const sock = await startSocket();
        return sock;
    } catch (error) {
        console.error("❌ Terjadi kesalahan fatal saat memulai bot:", error);
        console.log("🔥 Memulai restart penuh via PM2 dalam 10 detik...");
        setTimeout(() => process.exit(1), 10000);
    }
}