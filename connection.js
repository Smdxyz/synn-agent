// connection.js (MODIFIED FOR SELF-RESTARTING)

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
    connectTimeoutMs: 60000, 
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
      // DIUBAH: Lemparkan error agar loop utama berhenti
      throw new Error("Pairing failed");
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

      // ======================= PERUBAHAN UTAMA DI SINI =======================
      if (isLogout) {
        const reason = "Perangkat Telah Keluar (Logout)";
        console.log(`❌ ${reason}. Hapus 'auth_info_baileys' dan scan ulang.`);
        // DIUBAH: Lemparkan error spesifik untuk sinyal 'jangan restart'
        sock.ev.emit('connection.logout', new Error(reason));
      } 
      else if (isRestartRequired) {
        const reason = lastDisconnect.error?.message || 'Restart Required';
        console.error(`❌ Koneksi terputus. Alasan: ${reason}. Kode: ${statusCode}`);
        // DIUBAH: Lemparkan error spesifik untuk sinyal 'restart'
        sock.ev.emit('connection.restart', new Error(reason));
      }
      else {
        const reason = lastDisconnect.error?.message || 'Unknown Network Error';
        console.log(`🔌 Koneksi terputus sementara (${reason}). Baileys akan mencoba menyambung ulang otomatis.`);
      }
      // =======================================================================
    }
  });

  return sock;
}