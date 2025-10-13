# Synn Agent - WhatsApp Bot

![Node.js](https://img.shields.io/badge/Node.js-v18.0.0+-green.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Mode](https://img.shields.io/badge/Mode-Public-brightgreen.svg)

[ GAMBAR PROYEK ANDA DI SINI ]

## Tentang Proyek

**Synn Agent** adalah sebuah bot WhatsApp canggih yang dibangun menggunakan teknologi modern seperti:

*   **@whiskeysockets/baileys**: Untuk koneksi WhatsApp Web yang stabil dan andal.
*   **axios**: Untuk melakukan permintaan HTTP ke berbagai API.
*   **he**: Untuk menangani enkode/dekode entitas HTML.
*   **pino**: Untuk logging yang cepat dan terstruktur.

Bot ini dirancang untuk menjadi modular, mudah dikonfigurasi, dan dilengkapi dengan berbagai fitur yang berguna.

## Fitur Unggulan

*   **Modular Command System**: Perintah diatur dalam modul-modul yang rapi di dalam direktori `modules`, membuatnya mudah untuk dikelola dan dikembangkan.
*   **Smart Message Detection**: Mampu mendeteksi perintah dari berbagai jenis pesan, termasuk teks biasa, caption gambar/video, dan balasan tombol interaktif.
*   **Dynamic Command Loading**: Memuat semua perintah secara otomatis saat bot dijalankan, termasuk alias perintah.
*   **Configurable**: Pengaturan penting seperti pemilik bot, nama bot, mode (publik/pribadi), dan prefix dapat dengan mudah diubah melalui file `config.js`.
*   **Anti-Call**: Secara otomatis menolak panggilan masuk untuk menjaga bot tetap fokus pada tugasnya.
*   **State Management**: Mendukung perintah multi-langkah dengan sistem `waitState`.

## Instalasi & Penggunaan

Untuk menjalankan bot ini, ikuti langkah-langkah berikut:

1.  **Clone repository ini:**
    ```bash
    git clone <URL_REPOSITORY_ANDA>
    cd synn-agent
    ```

2.  **Install dependensi:**
    Pastikan Anda memiliki Node.js versi 18 atau lebih tinggi.
    ```bash
    npm install
    ```

3.  **Konfigurasi Bot:**
    Buka file `config.js` dan sesuaikan nilainya sesuai kebutuhan Anda.
    ```javascript
    // config.js
    export const config = {
      owner: "628xxxxxxxxxx", // Ganti dengan nomor Anda
      botName: "Nama Bot Anda",
      mode: "public", // 'public' atau 'private'
      antiCall: true,
      antiSpamKeywords: ["keyword1", "keyword2"],
      BOT_PREFIX: "!", // Ganti dengan prefix yang Anda inginkan
      WATERMARK: "Watermark Anda",
      SZYRINE_API_KEY: "YOUR_API_KEY_HERE" // Ganti dengan API Key Anda
    };
    ```

4.  **Jalankan Bot:**
    Untuk menjalankan bot, gunakan perintah:
    ```bash
    npm start
    ```
    Untuk pengembangan (dengan auto-reload):
    ```bash
    npm run dev
    ```

## Konfigurasi

Semua konfigurasi utama dapat ditemukan di `config.js`.

*   `owner`: Nomor WhatsApp pemilik bot.
*   `botName`: Nama bot yang akan ditampilkan.
*   `mode`: Mode operasi bot (`public` atau `private`).
*   `antiCall`: `true` untuk menolak panggilan, `false` untuk mengizinkan.
*   `antiSpamKeywords`: Daftar kata kunci untuk fitur anti-spam (fitur ini mungkin perlu diimplementasikan lebih lanjut).
*   `BOT_PREFIX`: Prefix yang digunakan untuk semua perintah.
*   `WATERMARK`: Watermark yang akan digunakan pada gambar atau media lain.
*   `SZYRINE_API_KEY`: API Key untuk layanan eksternal (jika ada).

## Struktur Perintah

Setiap file perintah di dalam direktori `modules` harus mengekspor fungsi `default` dengan struktur sebagai berikut:

```javascript
// modules/kategori/nama-perintah.js

// (opsional) tambahkan alias untuk perintah
export const aliases = ['alias1', 'alias2'];

// fungsi utama perintah
export default async function(sock, message, args, query, sender, extras) {
  // sock: instance koneksi Baileys
  // message: objek pesan lengkap
  // args: argumen perintah dalam bentuk array
  // query: seluruh teks setelah nama perintah
  // sender: JID pengirim pesan
  // extras: objek tambahan (seperti `commands` map dan fungsi `set` untuk waitState)

  // ... logika perintah Anda di sini ...
}
```

## Daftar Perintah

Berikut adalah kategori perintah yang tersedia:

*   **AI**: Perintah yang berhubungan dengan kecerdasan buatan.
*   **Downloader**: Perintah untuk mengunduh media dari berbagai sumber.
*   **Fun**: Perintah untuk hiburan.
*   **General**: Perintah umum.
*   **Images**: Perintah untuk manipulasi atau pembuatan gambar.
*   **Test**: Perintah untuk pengujian.
*   **Tools**: Alat bantu yang berguna.
*   **Utilitas**: Utilitas tambahan.

*(Anda dapat menambahkan daftar perintah spesifik di sini jika diinginkan)*

## Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT.
