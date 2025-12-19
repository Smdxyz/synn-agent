// connection.js — FIXED PAIRING & AGGRESSIVE RESTART VERSION

import { 
    makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    DisconnectReason 
} from '@whiskeysockets/baileys';
import pino from "pino";
import { Boom } from "@hapi/boom";
import readline from "readline";

// Setup input terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

export async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // Kita pakai Pairing Code, jadi QR dimatikan
    // Logger silent biar terminal bersih
    logger: pino({ level: "silent" }), 
    
    // Settingan Timeout & Retry
    keepAliveIntervalMs: 10000, 
    emitOwnEvents: true,
    retryRequestDelayMs: 250,
    connectTimeoutMs: 60000, // Tambah waktu timeout koneksi awal

    // [PENTING] Gunakan identitas browser standar (Ubuntu/Chrome) 
    // agar notifikasi di HP lebih cepat muncul dan tidak dianggap spam.
    browser: ["Ubuntu", "Chrome", "20.0.04"], 
  });

  // --- LOGIKA PAIRING CODE ---
  if (!sock.authState.creds.registered) {
    // Tunggu 4 detik agar socket benar-benar siap sebelum minta input
    console.log("\n⏳ Menyiapkan server untuk pairing...");
    await new Promise(r => setTimeout(r, 4000)); 

    const phoneNumber = await question(
      "\nMasukkan nomor WhatsApp Anda (cth: 6281234567890): "
    );

    // Bersihkan nomor dari karakter non-angka
    const codePhone = phoneNumber.replace(/[^0-9]/g, '');

    try {
      const code = await sock.requestPairingCode(codePhone);
      // Ubah format kode biar lebih enak dibaca (contoh: ABC-DEF-GH)
      const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
      
      console.log(`\n================================`);
      console.log(` KODE PAIRING:  ${formattedCode}`);
      console.log(`================================`);
      console.log(`\nCARA INPUT DI HP:`);
      console.log(`1. Buka WA > Titik Tiga > Perangkat Tertaut`);
      console.log(`2. Klik "Tautkan Perangkat"`);
      console.log(`3. Klik tulisan di bawah: "Tautkan dengan nomor telepon saja"`);
      console.log(`4. Masukkan kode di atas.\n`);
      
    } catch (error) {
      console.error("Gagal meminta kode pairing. Pastikan nomor benar.", error);
    }
  }

  // Simpan kredensial setiap ada update
  sock.ev.on("creds.update", saveCreds);

  // --- LOGIKA KONEKSI ---
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("\n✅ [STATUS] Koneksi Tersambung! Bot siap digunakan.");
    } 
    
    else if (connection === "close") {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      
      // Fallback jika error tidak standar
      if (!reason && lastDisconnect?.error) {
          reason = lastDisconnect.error.message || "Unknown Error";
      }

      // 1. KASUS LOGOUT (Sesi Dihapus/Tidak Valid)
      if (reason === DisconnectReason.loggedOut) {
        console.error(`❌ [FATAL] Perangkat Logout. Hapus folder 'auth_info_baileys' dan scan ulang.`);
        sock.ev.emit('connection.logout', new Error("Logged Out"));
      } 
      
      // 2. KASUS RESTART REQUIRED (Biasanya 415)
      else if (reason === DisconnectReason.restartRequired) {
        console.log("🔄 [INFO] Server meminta restart session.");
        sock.ev.emit('connection.restart', new Error("Restart Required"));
      }

      // 3. KASUS ERROR LAIN (Koneksi putus biasa)
      else {
        console.warn(`⚠️ [DISCONNECT] Terputus (Code: ${reason}). Mencoba sambung ulang...`);
        // Trigger restart di bot.js
        sock.ev.emit('connection.restart', new Error(`Auto Restart (Code: ${reason})`));
      }
    }
  });

  return sock;
}