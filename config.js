// config.js

export const config = {
  owner: "149804483104935",
  botName: "Synn Bots",
  mode: "public",
  antiCall: true,
  antiSpamKeywords: ["pinjol", "pinjaman online"],
  BOT_PREFIX: ".",
  WATERMARK: "Synn WhatsApp",
  SZYRINE_API_KEY: "SANN21",
  
  // --- KONFIGURASI SISTEM POIN ---
  points: {
    defaultPoints: 100,    // Poin awal user baru
    checkinPoints: 5,      // Poin dari check-in per jam
    vipPrice: 30,          // Harga VIP dalam poin
    vipDurationDays: 3     // Durasi VIP (hari)
  }
};
