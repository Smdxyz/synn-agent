// /modules/general/menu.js (VERSI TEKS SAJA)

import { config } from '../../config.js';
import { sendMessage } from '../../helper.js';

function getGreeting() {
    const hour = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false });
    const h = parseInt(hour, 10);
    if (h >= 4 && h < 11) return 'Selamat Pagi';
    if (h >= 11 && h < 15) return 'Selamat Siang';
    if (h >= 15 && h < 19) return 'Selamat Sore';
    return 'Selamat Malam';
}

// --- FUNGSI UTAMA COMMAND ---
export default async function menu(sock, msg, args, query, sender, extras) {
    const { commands } = extras; 
    const userName = msg.pushName || 'Kawan';
    const greeting = getGreeting();
    const prefix = config.BOT_PREFIX;

    // --- Pengelompokan Command ---
    const categorizedCommands = {};
    const processedCommands = new Set(); 

    commands.forEach((module, name) => {
        // Hindari duplikasi dari alias
        if (processedCommands.has(module)) return;
        
        const category = module.category || 'Lainnya';
        
        // Cari nama utama command (bukan alias)
        let mainName = name;
        for (const [cmdName, cmdModule] of commands.entries()) {
            if (cmdModule === module && !cmdModule.aliases?.includes(cmdName)) {
                mainName = cmdName;
                break;
            }
        }
        
        if (!categorizedCommands[category]) {
            categorizedCommands[category] = [];
        }
        
        categorizedCommands[category].push({ 
            name: mainName, 
            description: module.description || 'Tidak ada deskripsi.' 
        });
        processedCommands.add(module);
    });

    // --- Pembuatan Pesan Menu ---
    let menuText = `
${greeting}, *${userName}*! 👋

Berikut adalah daftar perintah yang tersedia di *${config.botName}*:

`;

    // Urutkan kategori berdasarkan abjad
    const sortedCategories = Object.keys(categorizedCommands).sort();

    for (const category of sortedCategories) {
        menuText += `*╭─「 ${category.toUpperCase()} 」*\n`;
        const commandsInCategory = categorizedCommands[category];
        
        for (const cmd of commandsInCategory) {
            menuText += `*│* ◦ \`${prefix}${cmd.name}\`\n`;
            // Tambahkan deskripsi jika ada
            // menuText += `*│*    └ ${cmd.description}\n`; 
        }
        menuText += `*╰───*\n\n`;
    }
    
    menuText += `Ketik \`${prefix}help <nama_command>\` untuk melihat detail penggunaan.`;
    
    await sendMessage(sock, sender, menuText.trim(), { quoted: msg });
}

// --- METADATA COMMAND ---
export const category = 'General';
export const description = 'Menampilkan menu utama bot.';
export const usage = `${config.BOT_PREFIX}menu`;
export const aliases = ['help', 'cmd'];