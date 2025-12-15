// message.handler.js (FINAL & SUPPORTS DYNAMIC SELF-RESPONSE)

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';
import { settings } from './settings.js'; // <-- IMPORT MODUL SETTINGS BARU

// ---- PENYIMPANAN COMMAND & STATE ----
export const commands = new Map();
const waitState = new Map();

// ... (Fungsi loadCommands tetap sama persis seperti di jawaban sebelumnya, tidak perlu diubah)
async function loadCommands() {
    const modulesPath = join(process.cwd(), 'modules');
    if (!readdirSync(process.cwd()).includes('modules')) {
        console.warn("[LOADER] Folder 'modules' tidak ditemukan. Melewatkan pemuatan command.");
        return;
    }
    const commandFolders = readdirSync(modulesPath);
    for (const folder of commandFolders) {
        const fullPath = join(modulesPath, folder);
        if (statSync(fullPath).isDirectory()) {
            const commandFiles = readdirSync(fullPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                try {
                    const modulePath = join(fullPath, file);
                    const commandModule = await import(`file://${modulePath}`);
                    commandModule.filePath = modulePath;
                    const commandName = file.replace('.js', '');
                    commands.set(commandName, commandModule);
                    console.log(`[LOADER] Berhasil memuat command: ${commandName} dari ${folder}`);
                    if (commandModule.aliases && Array.isArray(commandModule.aliases)) {
                        commandModule.aliases.forEach(alias => {
                            commands.set(alias, commandModule);
                            console.log(`[LOADER] Mendaftarkan alias: ${alias} -> ${commandName}`);
                        });
                    }
                } catch (error) {
                    console.error(`[LOADER] Gagal memuat command ${file} dari ${folder}:`, error);
                }
            }
        }
    }
}
loadCommands();


// ---- HANDLER UTAMA (DENGAN DETEKSI PESAN CERDAS) ----
export const handleMessage = async (sock, m) => {
    const message = m.messages[0];
    
    // ================== PERUBAHAN LOGIKA UTAMA DI SINI ==================
    // 1. Cek dulu apakah ada message atau tidak
    if (!message.message) return;

    // 2. Ambil pengaturan saat ini
    const botSettings = settings.get();

    // 3. Jika pesan berasal dari bot DAN fitur self-response NONAKTIF, maka abaikan.
    if (message.key.fromMe && !botSettings.allowSelfResponse) {
        return;
    }
    // ===================================================================

    const sender = message.key.remoteJid;

    // --- (Sisa kode dari sini ke bawah tetap sama persis, tidak perlu diubah) ---
    let body = '';
    const msg = message.message;
    if (msg.conversation) {
        body = msg.conversation;
    } else if (msg.extendedTextMessage) {
        body = msg.extendedTextMessage.text;
    } else if (msg.imageMessage?.caption) {
        body = msg.imageMessage.caption;
    } else if (msg.videoMessage?.caption) {
        body = msg.videoMessage.caption;
    } else if (msg.buttonsResponseMessage) {
        body = msg.buttonsResponseMessage.selectedButtonId;
    } else if (msg.listResponseMessage) {
        body = msg.listResponseMessage.singleSelectReply?.selectedRowId;
    } else if (msg.templateButtonReplyMessage) {
        body = msg.templateButtonReplyMessage.selectedId;
    }
    const text = body; 
    if (!text) return; 

    if (waitState.has(sender)) {
        const currentState = waitState.get(sender);
        if (Date.now() - currentState.timestamp > currentState.timeout) {
            waitState.delete(sender);
            return sock.sendMessage(sender, { text: "Waktu pemilihan habis." });
        }
        if (typeof currentState.handler === 'function') {
            const handled = currentState.handler(sock, message, text, currentState.context);
            if (handled) waitState.delete(sender);
        }
        return;
    }
    const prefix = config.BOT_PREFIX;
    if (!text.startsWith(prefix)) return;
    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const commandModule = commands.get(commandName);
    const query = text.slice(prefix.length + commandName.length).trim();
    if (commandModule) {
        try {
            const extras = {
                commands,
                set: (userId, command, options) => {
                    waitState.set(userId, {
                        command: command,
                        handler: options.handler,
                        context: options.context || {},
                        timestamp: Date.now(),
                        timeout: options.timeout || 60000 
                    });
                },
            };
            await commandModule.default(sock, message, args, query, sender, extras);
        } catch (error) {
            console.error(`[EXECUTION ERROR] Command: ${commandName}`, error);
            sock.sendMessage(sender, { text: `Terjadi error saat menjalankan command: ${error.message}` }, { quoted: message });
        }
    }
};