// monitoring.js

import axios from 'axios';

// ⚙️ --- KONFIGURASI --- ⚙️
// URL API server-mu, disesuaikan dengan permintaan.
const API_URL = 'https://szyrineapi.biz.id/api/bot/signal';

// API Key bot-mu.
const BOT_API_KEY = 'SYNNBOT21X';

// Seberapa sering bot mengirim "saya masih hidup" (dalam milidetik).
// 25000ms = 25 detik.
const HEARTBEAT_INTERVAL_MS = 25000;
// -------------------------

// Variabel untuk menyimpan ID dari setInterval, agar bisa dihentikan nanti.
let heartbeatIntervalId = null;

/**
 * Mengirim sinyal ke server monitoring.
 * Fungsi ini akan dipanggil saat pertama kali konek dan setiap interval heartbeat.
 */
async function sendSignalToServer() {
    // Validasi: Pastikan BOT_API_KEY sudah di-set.
    if (!BOT_API_KEY) {
        console.error('🔥 [MONITORING] Error: BOT_API_KEY tidak di-set!');
        // Hentikan interval jika key tidak ada, untuk mencegah error berulang.
        if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
        return;
    }

    try {
        await axios.post(
            API_URL, 
            {}, // Body request bisa kosong, server hanya butuh sinyalnya.
            { 
                headers: { 
                    'X-Bot-Key': BOT_API_KEY,
                    'Content-Type': 'application/json'
                } 
            }
        );
        console.log(`❤️  [MONITORING] Heartbeat berhasil dikirim ke server pada ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        const errorMessage = error.response 
            ? `Server merespon dengan status ${error.response.status}: ${error.response.data?.message || 'No message from server'}`
            : error.message;
        console.error(`🔥 [MONITORING] Gagal mengirim sinyal ke server: ${errorMessage}`);
    }
}

/**
 * Fungsi yang harus dipanggil KETIKA BOT BERHASIL TERHUBUNG.
 * Ini akan mengirim sinyal pertama dan memulai heartbeat rutin.
 */
export function onBotConnected() {
    console.log('✅ [MONITORING] Bot terhubung! Mengirim sinyal awal dan memulai heartbeat rutin...');
    
    // Hentikan interval lama jika ada (untuk kasus reconnect).
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
    }
    
    // 1. Langsung kirim sinyal pertama kali saat terhubung.
    sendSignalToServer();
    
    // 2. Mulai kirim heartbeat secara berkala.
    heartbeatIntervalId = setInterval(sendSignalToServer, HEARTBEAT_INTERVAL_MS);
}

/**
 * Fungsi yang harus dipanggil KETIKA KONEKSI BOT TERPUTUS.
 * Ini akan menghentikan pengiriman heartbeat.
 */
export function onBotDisconnected() {
    console.log('❌ [MONITORING] Koneksi bot terputus! Menghentikan pengiriman heartbeat.');
    
    // Hentikan interval agar bot tidak lagi mengirim sinyal saat offline.
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null; // Reset ID
    }
}