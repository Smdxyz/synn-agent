// bot.js (MODIFIED FOR SELF-RESTARTING)

import { connectToWhatsApp } from "./connection.js";
import { handleMessage } from "./message.handler.js";
import { handleCall } from "./call.handler.js";

async function runBot() {
  return new Promise(async (resolve, reject) => {
    try {
      const sock = await connectToWhatsApp();

      // Pasang listener untuk event kustom kita
      sock.ev.on('connection.restart', (error) => reject(error));
      sock.ev.on('connection.logout', (error) => resolve(error)); // Resolve menandakan penghentian normal

      // Pasang listener utama
      sock.ev.on("messages.upsert", async (m) => {
        await handleMessage(sock, m);
      });

      sock.ev.on("call", async (call) => {
        await handleCall(sock, call[0]);
      });
    } catch (error) {
        // Menangkap error dari connectToWhatsApp (misal: pairing gagal)
        reject(error);
    }
  });
}

// Fungsi utama yang mengontrol loop restart
async function main() {
  let shouldRestart = true;

  while (shouldRestart) {
    try {
      await runBot();
      // Jika runBot() resolve (karena logout), kita hentikan loop
      console.log("Proses dihentikan secara normal (logout). Bot tidak akan restart.");
      shouldRestart = false;
    } catch (error) {
      // Jika runBot() reject (karena restart required), loop akan berlanjut
      console.error(`🔥 Terdeteksi sinyal restart: ${error.message}`);
      console.log("Memulai ulang koneksi dalam 5 detik...");
      await new Promise(r => setTimeout(r, 5000)); // Beri jeda 5 detik
      shouldRestart = true;
    }
  }
}

// Jalankan fungsi utama
main();