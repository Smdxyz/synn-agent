// bot.js — FINAL LOOP HANDLER

import { connectToWhatsApp } from "./connection.js";
import { handleMessage } from "./message.handler.js";
import { handleCall } from "./call.handler.js";

async function runBot() {
  return new Promise(async (resolve, reject) => {
    try {
      const sock = await connectToWhatsApp();

      // ===============================================
      // HANDLER UNTUK SIGNAL DARI CONNECTION.JS
      // ===============================================

      // Jika terjadi error koneksi apapun, terima sinyal restart
      sock.ev.on('connection.restart', (err) => {
          // Tutup socket agar tidak ada event memory leak
          sock.end(err); 
          reject(err); // Reject akan memicu catch di fungsi main()
      });

      // Jika terjadi logout
      sock.ev.on('connection.logout', (err) => {
          sock.end(err);
          resolve(err); // Resolve akan menghentikan loop while di main()
      });

      // ===============================================
      // LISTENER UTAMA
      // ===============================================

      sock.ev.on("messages.upsert", async (m) => {
        await handleMessage(sock, m);
      });

      sock.ev.on("call", async (call) => {
        await handleCall(sock, call[0]);
      });

    } catch (error) {
        // Tangkap error inisialisasi awal
        reject(error);
    }
  });
}

async function main() {
  let shouldRestart = true;
  console.log("🚀 Memulai Synn Agent...");

  while (shouldRestart) {
    try {
      await runBot();
      // Jika runBot RESOLVE, berarti Logout atau berhenti normal
      console.log("🛑 Bot berhenti secara normal.");
      shouldRestart = false;
    } catch (error) {
      // Jika runBot REJECT, berarti ada error koneksi (428, 515, dll)
      console.error(`\n♻️  [AUTO-RESTART] Mendeteksi gangguan: ${error.message}`);
      console.log("⏳  Menunggu 5 detik sebelum menyambung ulang...\n");
      
      await new Promise(r => setTimeout(r, 5000)); // Delay agar tidak spam server WA
      shouldRestart = true;
    }
  }
}

main();