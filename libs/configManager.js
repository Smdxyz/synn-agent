import fs from 'fs';
import path from 'path';
import paths from './paths.js';

const configFilePath = path.join(paths.database, 'config.json');

const defaultConfig = {
  owner: "149804483104935",
  botName: "Synn Bots",
  mode: "public",
  antiCall: true,
  antiSpamKeywords: ["pinjol", "pinjaman online"],
  BOT_PREFIX: ".",
  WATERMARK: "Synn WhatsApp",
  SZYRINE_API_KEY: "SANN21",

  coins: {
    defaultCoins: 100,    // Koin awal user baru
    checkinCoins: 5,      // Koin dari check-in per jam
    vipPrice: 30,         // Harga VIP dalam koin
    vipDurationDays: 3    // Durasi VIP (hari)
  }
};

function loadConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            const fileContent = fs.readFileSync(configFilePath, 'utf-8');
            const savedConfig = JSON.parse(fileContent);
            return { ...defaultConfig, ...savedConfig, coins: { ...defaultConfig.coins, ...(savedConfig.coins || {}) } };
        } else {
            fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
    } catch (error) {
        console.error("[CONFIG] Gagal memuat konfigurasi, menggunakan default:", error);
        return defaultConfig;
    }
}

function saveConfig(configObject) {
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(configObject, null, 2));
    } catch (error) {
        console.error("[CONFIG] Gagal menyimpan konfigurasi:", error);
    }
}

let currentConfig = loadConfig();

export const configManager = {
    get: () => currentConfig,
    set: (key, value) => {
        // Mendukung nested key seperti "coins.defaultCoins"
        if (key.includes('.')) {
            const keys = key.split('.');
            if (keys.length === 2 && keys[0] === 'coins') {
                currentConfig.coins[keys[1]] = value;
            }
        } else {
            currentConfig[key] = value;
        }
        saveConfig(currentConfig);
    },
    reload: () => {
        currentConfig = loadConfig();
        return currentConfig;
    }
};
