// message.handler.js (FINAL & CLEAN VERSION)

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';
import { settings } from './settings.js';

// ---- PENYIMPANAN COMMAND & STATE ----
export const commands = new Map();
const waitState = new Map();

// ---- FUNGSI UNTUK MEMUAT SEMUA COMMAND SECARA OTOMATIS (VERSI SUB-FOLDER) ----
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
                    const originalModule = await import(`file://${modulePath}`);

                    // [FIX] Buat salinan modul agar bisa dimodifikasi (menghindari error "not extensible")
                    const commandModule = { ...originalModule };
                    
                    // Tambahkan path file ke salinan modul
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

// Panggil fungsi loader saat aplikasi pertama kali berjalan
loadCommands();


// ---- HANDLER UTAMA (DENGAN DETEKSI PESAN CERDAS) ----
export const handleMessage = async (sock, m) => {
    const message = m.messages[0];
    
    // Abaikan jika tidak ada konten pesan
    if (!message.message) return;

    // [FITUR] Kontrol self-response secara dinamis
    const botSettings = settings.get();
    if (message.key.fromMe && !botSettings.allowSelfResponse) {
        return;
    }

    const sender = message.key.remoteJid;

    // --- Logika Deteksi Pesan Cerdas (termasuk caption, tombol, dll) ---
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

    // --- Penanganan 'waitState' untuk command interaktif ---
    if (waitState.has(sender)) {
        const currentState = waitState.get(sender);
        if (Date.now() - currentState.timestamp > currentState.timeout) {
            waitState.delete(sender);
            return sock.sendMessage(sender, { text: "Waktu pemilihan habis." });
        }
        if (typeof currentState.handler === 'function') {
            const handled = currentState.handler(sock, message, text, currentState.context);
            if (handled) {
                waitState.delete(sender);
            }
        }
        return;
    }

    // --- Eksekusi Command Biasa ---
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