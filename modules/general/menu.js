// /modules/general/menu.js (VERSI UX DITINGKATKAN BERDASARKAN ANALISIS)

import { config } from '../../config.js';
import { sendImage, sendList, delay, sendMessage } from '../../helper.js';
import fs from 'fs';
import path from 'path';

// --- DATA & FUNGSI BANTUAN ---

const quotes = [
    "Cara terbaik untuk memulai adalah dengan berhenti berbicara dan mulai melakukan.",
    "Jangan biarkan hari kemarin menyita terlalu banyak hari ini.",
    "Satu-satunya batasan untuk mewujudkan hari esok adalah keraguan kita hari ini.",
];

function getGreeting() {
    const hour = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false });
    const h = parseInt(hour, 10);
    if (h >= 4 && h < 11) return 'Selamat Pagi';
    if (h >= 11 && h < 15) return 'Selamat Siang';
    if (h >= 15 && h < 19) return 'Selamat Sore';
    return 'Selamat Malam';
}

// --- FUNGSI UTAMA COMMAND ---
export default async function execute(sock, msg, args, query, sender, extras) {
    const { commands } = extras; 
    const userName = msg.pushName || 'Kawan';
    
    const greeting = getGreeting();
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    // --- PESAN 1: Sapaan & Banner (Lebih Minimalis) ---
    const headerText = `
${greeting}, *${userName}*! 👋

Selamat datang di *${config.botName}*.
Pilih perintah dari menu di bawah untuk memulai.

*❝ ${randomQuote} ❞*
`.trim();

    try {
        const imagePath = path.join(process.cwd(), 'assets', 'menu-header.png');
        const imageBuffer = fs.readFileSync(imagePath);
        await sendImage(sock, sender, imageBuffer, headerText);
    } catch (error) {
        console.error('[MENU] Gagal membaca atau mengirim header gambar lokal:', error.message);
        await sendMessage(sock, sender, headerText);
    }
    
    await delay(250);

    // --- PESAN 2: Menu Interaktif dengan Bagian Bantuan ---
    const categorizedCommands = {};
    const processedCommands = new Set(); 

    commands.forEach((module, name) => {
        if (processedCommands.has(module)) return;
        const category = module.category || 'Lainnya';
        let mainName = name;
        for (const [cmdName, cmdModule] of commands.entries()) {
            if (cmdModule === module && !cmdModule.aliases?.includes(cmdName)) {
                mainName = cmdName;
                break;
            }
        }
        if (!categorizedCommands[category]) categorizedCommands[category] = [];
        categorizedCommands[category].push({ 
            name: mainName, 
            description: module.description || 'Tidak ada deskripsi.' 
        });
        processedCommands.add(module);
    });

    // [REKOMENDASI DITERAPKAN] Membuat bagian baru yang lebih relevan untuk pengguna
    const helpSection = {
        title: "BANTUAN & INFORMASI",
        rows: [
            {
                title: "Statistik Bot",
                rowId: `${config.BOT_PREFIX}stats`,
                description: "Lihat statistik lengkap & waktu aktif bot."
            },
            {
                title: "Lapor Bug / Saran",
                rowId: `${config.BOT_PREFIX}report [pesan]`,
                description: "Kirim laporan bug atau saran ke developer."
            }
        ]
    };

    const commandSections = Object.keys(categorizedCommands).sort().map(category => ({
        title: `Kategori: ${category.toUpperCase()}`,
        rows: categorizedCommands[category].map(cmd => ({
            title: `${config.BOT_PREFIX}${cmd.name}`,
            rowId: `${config.BOT_PREFIX}${cmd.name}`,
            description: cmd.description
        }))
    }));

    // Gabungkan bagian bantuan di paling atas, diikuti oleh kategori command
    const allSections = [helpSection, ...commandSections];

    await sendList(sock, sender, `Daftar Perintah ${config.botName}`, 'Silakan pilih perintah yang Anda butuhkan.', 'Tampilkan Menu', allSections);
}

// --- METADATA COMMAND ---
export const category = 'General';
export const description = 'Menampilkan menu utama bot.';
export const usage = `${config.BOT_PREFIX}menu`;
export const aliases = ['help', 'cmd'];