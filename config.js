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
  
  // --- KONFIGURASI SHEERID & SISTEM POIN ---
  sheerid: {
    // Daftar proxy, format: "http://user:pass@host:port".
    proxies: [
        "http://jlwwrxcb:jlsap2tictuq@142.111.48.253:7030",
        "http://jlwwrxcb:jlsap2tictuq@23.95.150.145:6114",
        "http://jlwwrxcb:jlsap2tictuq@198.23.239.134:6540",
        "http://jlwwrxcb:jlsap2tictuq@107.172.163.27:6543",
        "http://jlwwrxcb:jlsap2tictuq@216.10.27.159:6837",
        "http://jlwwrxcb:jlsap2tictuq@142.147.128.93:6593",
        "http://pmdwdiwc:dxl2es75qoki@142.111.48.253:7030",
        "http://pmdwdiwc:dxl2es75qoki@23.95.150.145:6114",
        "http://pmdwdiwc:dxl2es75qoki@198.23.239.134:6540",
        "http://pmdwdiwc:dxl2es75qoki@107.172.163.27:6543",
        "http://pmdwdiwc:dxl2es75qoki@216.10.27.159:6837",
        "http://pmdwdiwc:dxl2es75qoki@142.147.128.93:6593",
        "http://mocoyonx:fofxjckl6bv1@142.111.48.253:7030",
        "http://mocoyonx:fofxjckl6bv1@23.95.150.145:6114",
        "http://mocoyonx:fofxjckl6bv1@198.23.239.134:6540",
        "http://mocoyonx:fofxjckl6bv1@107.172.163.27:6543",
        "http://mocoyonx:fofxjckl6bv1@216.10.27.159:6837",
        "http://mocoyonx:fofxjckl6bv1@142.147.128.93:6593",
        "http://meydqxfz:jirxz9hano69@142.111.48.253:7030",
        "http://meydqxfz:jirxz9hano69@23.95.150.145:6114",
        "http://meydqxfz:jirxz9hano69@198.23.239.134:6540",
        "http://meydqxfz:jirxz9hano69@107.172.163.27:6543",
        "http://meydqxfz:jirxz9hano69@216.10.27.159:6837",
        "http://seylldqd:rf4o85jzw0cl@142.111.48.253:7030",
        "http://seylldqd:rf4o85jzw0cl@23.95.150.145:6114",
        "http://seylldqd:rf4o85jzw0cl@198.23.239.134:6540",
        "http://seylldqd:rf4o85jzw0cl@107.172.163.27:6543",
        "http://seylldqd:rf4o85jzw0cl@216.10.27.159:6837",
        "http://kvsebsmq:vwiff6khyzfy@142.111.48.253:7030",
        "http://kvsebsmq:vwiff6khyzfy@23.95.150.145:6114",
        "http://kvsebsmq:vwiff6khyzfy@198.23.239.134:6540",
        "http://kvsebsmq:vwiff6khyzfy@107.172.163.27:6543",
        "http://kvsebsmq:vwiff6khyzfy@216.10.27.159:6837",
        "http://iwatgiox:y6v4yz0c0koi@142.111.48.253:7030",
        "http://iwatgiox:y6v4yz0c0koi@23.95.150.145:6114",
        "http://iwatgiox:y6v4yz0c0koi@198.23.239.134:6540",
        "http://iwatgiox:y6v4yz0c0koi@107.172.163.27:6543",
        "http://iwatgiox:y6v4yz0c0koi@216.10.27.159:6837",
        "http://cgaechja:uzyh6rqssnl7@142.111.48.253:7030",
        "http://cgaechja:uzyh6rqssnl7@23.95.150.145:6114",
        "http://cgaechja:uzyh6rqssnl7@198.23.239.134:6540",
        "http://cgaechja:uzyh6rqssnl7@107.172.163.27:6543",
    ],
    // Biaya dalam Poin
    verificationCost: 50,  // Biaya normal untuk verifikasi
    proxyCost: 10,         // Biaya tambahan untuk proxy bagi user non-VIP
    // Poin & VIP
    checkinPoints: 5,      // Poin yang didapat dari checkin per jam
    vipPrice: 30,          // Harga 3 hari VIP dalam Poin
    referralBonus: 0.20,   // Bonus 20% dari biaya verif yang dibayar teman
  }
};