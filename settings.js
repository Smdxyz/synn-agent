// settings.js

import fs from 'fs';
import path from 'path';

// Tentukan path ke file settings, ini akan membuat file bot_settings.json di folder utama
const settingsFilePath = path.join(process.cwd(), 'bot_settings.json');

// Pengaturan default jika file tidak ada
const defaultSettings = {
    allowSelfResponse: false // Paling aman untuk default ke 'false' (nonaktif)
};

// Fungsi untuk memuat pengaturan dari file
function loadSettings() {
    try {
        if (fs.existsSync(settingsFilePath)) {
            const fileContent = fs.readFileSync(settingsFilePath, 'utf-8');
            return JSON.parse(fileContent);
        } else {
            // Jika file tidak ada, buat dengan pengaturan default
            fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSettings, null, 2));
            return defaultSettings;
        }
    } catch (error) {
        console.error("[SETTINGS] Gagal memuat pengaturan, menggunakan default:", error);
        return defaultSettings;
    }
}

// Fungsi untuk menyimpan pengaturan ke file
function saveSettings(settingsObject) {
    try {
        fs.writeFileSync(settingsFilePath, JSON.stringify(settingsObject, null, 2));
    } catch (error) {
        console.error("[SETTINGS] Gagal menyimpan pengaturan:", error);
    }
}

// Muat pengaturan saat aplikasi pertama kali berjalan
let currentSettings = loadSettings();

// Ekspor objek yang berisi metode untuk berinteraksi dengan pengaturan
export const settings = {
    /**
     * Mendapatkan semua pengaturan saat ini.
     * @returns {object} Objek pengaturan.
     */
    get: () => currentSettings,

    /**
     * Mengubah nilai pengaturan dan langsung menyimpannya ke file.
     * @param {string} key - Kunci pengaturan yang akan diubah (misal: 'allowSelfResponse').
     * @param {*} value - Nilai baru untuk pengaturan.
     */
    set: (key, value) => {
        currentSettings[key] = value;
        saveSettings(currentSettings);
    }
};