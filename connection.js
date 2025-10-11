// connection.js (UPGRADED WITH ROBUST RECONNECTION & MONITORING)

import * as baileys from '@whiskeysockets/baileys';
import pino from "pino";
import { Boom } from "@hapi/boom";
import readline from "readline";
import { onBotConnected, onBotDisconnected } from './monitoring.js'; // <-- IMPORT MONITORING

// Pengaturan untuk membaca input dari terminal
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
    logger: pino({ level: "debug" }), // Logger tetap debug biar kelihatan prosesnya
  });

  // Logika untuk Pairing Code
  if (!sock.authState.creds.registered) {
    await new Promise(r => setTimeout(r, 1500)); 
    
    const phoneNumber = await question(
      "\nMasukkan nomor WhatsApp Anda dengan kode negara (contoh: 6281234567890): "
    );
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`\n================================`);
      console.log(` Kode Pairing Anda: ${code}`);
      console.log(`================================\n`);
      console.log("Buka WhatsApp di HP -> Perangkat Tertaut -> Tautkan dengan nomor -> Masukkan kode.");
    } catch (error) {
      console.error("Gagal meminta kode pairing:", error);
      rl.close();
    }
    // Jangan tutup rl di sini, biarkan event 'open' yang menanganinya
  }

  sock.ev.on("creds.update", saveCreds);

  // --- LOGIKA KONEKSI YANG DI-UPGRADE ---
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("\n✅ Koneksi berhasil tersambung! Bot siap digunakan.\n");
      onBotConnected(); // <-- PANGGIL MONITORING SAAT KONEK
      if (!rl.closed) rl.close(); // Tutup readline interface jika masih terbuka
    } 
    
    else if (connection === "close") {
      onBotDisconnected(); // <-- PANGGIL MONITORING SAAT DISKONEK

      const statusCode = (lastDisconnect.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 500;
      let shouldReconnect = true;
      let reason = `Tidak diketahui: ${lastDisconnect.error?.message || 'Unknown Error'}`;

      switch (statusCode) {
        case baileys.DisconnectReason.badSession:
          reason = "File Sesi Buruk, hapus folder 'auth_info_baileys' dan scan ulang.";
          shouldReconnect = false; // Jangan reconnect, butuh tindakan manual
          break;
        case baileys.DisconnectReason.connectionClosed:
          reason = "Koneksi Ditutup, mencoba menyambungkan kembali...";
          break;
        case baileys.DisconnectReason.connectionLost:
          reason = "Koneksi Terputus dari Server, mencoba menyambungkan kembali...";
          break;
        case baileys.DisconnectReason.connectionReplaced:
          reason = "Koneksi Digantikan, sesi baru telah dibuka di tempat lain.";
          shouldReconnect = false;
          break;
        case baileys.DisconnectReason.loggedOut:
          reason = "Perangkat Telah Keluar (Logout), hapus 'auth_info_baileys' dan scan ulang.";
          shouldReconnect = false;
          break;
        case baileys.DisconnectReason.restartRequired:
          reason = "Diperlukan Restart, mencoba menyambungkan kembali...";
          break;
        case baileys.DisconnectReason.timedOut:
          reason = "Koneksi Timeout, mencoba menyambungkan kembali...";
          break;
        case 401: // Unauthorized, sering terjadi jika butuh pairing code lagi
           reason = "Tidak terautentikasi (401). Kemungkinan perlu pairing code ulang.";
           shouldReconnect = true; // Coba sambungkan lagi, jika gagal terus user akan lihat lognya
           break;
        default:
          reason = `Kode Kesalahan ${statusCode}, mencoba menyambungkan kembali...`;
          break;
      }
      
      console.log(`❌ Koneksi terputus. Alasan: ${reason}`);
      
      if (shouldReconnect) {
        console.log("Mencoba menyambung kembali dalam 5 detik...");
        setTimeout(connectToWhatsApp, 5000); // Beri jeda sebelum reconnect
      } else {
        console.log("Bot tidak akan menyambung kembali secara otomatis.");
      }
    }
  });

  return sock;
}