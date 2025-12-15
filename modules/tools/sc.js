// /modules/tools/sc.js

import { readFileSync } from 'fs';
import { sendMessage, sendDoc } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Tools';
export const description = 'Melihat source code dari sebuah command.';
export const usage = `${config.BOT_PREFIX}sc <nama_command>`;
export const aliases = ['sourcecode', 'getcode'];

// --- FUNGSI UTAMA ---
export default async function sc(sock, msg, args, query, sender, extras) {
    const commandName = query.trim().toLowerCase();
    if (!commandName) {
        return sendMessage(sock, sender, `Silakan berikan nama command yang ingin dilihat.\n\n*Contoh:*\n\`${usage}\``, { quoted: msg });
    }

    const { commands } = extras; // Ambil map 'commands' dari extras
    const commandModule = commands.get(commandName);

    if (!commandModule) {
        return sendMessage(sock, sender, `Command \`${commandName}\` tidak ditemukan.`, { quoted: msg });
    }

    // Ambil path file yang sudah kita 'suntikkan' di message.handler.js
    const filePath = commandModule.filePath;

    if (!filePath) {
        return sendMessage(sock, sender, `Gagal menemukan path file untuk command \`${commandName}\`. Pastikan message.handler.js sudah diperbarui.`, { quoted: msg });
    }

    try {
        const fileContent = readFileSync(filePath, 'utf-8');
        
        if (fileContent.length > 3000) {
            // Jika teks terlalu panjang, kirim sebagai file .txt
            await sendDoc(
                sock, 
                sender, 
                Buffer.from(fileContent, 'utf-8'), 
                `${commandName}.js.txt`, 
                'text/plain', 
                { quoted: msg, caption: `Source code untuk \`${commandName}\`:` }
            );
        } else {
            // Jika tidak, kirim sebagai teks biasa
            const formattedContent = "```javascript\n" + fileContent + "\n```";
            await sendMessage(sock, sender, formattedContent, { quoted: msg });
        }
    } catch (error) {
        console.error(`[SC_ERROR] Gagal membaca file ${filePath}:`, error);
        await sendMessage(sock, sender, `Terjadi error saat membaca source code: ${error.message}`, { quoted: msg });
    }
}