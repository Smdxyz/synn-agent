// message.handler.js (FINAL & SUPPORTS INTERACTIVE MESSAGES + CAPTIONS)

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

// ---- PENYIMPANAN COMMAND & STATE ----
export const commands = new Map();
const waitState = new Map();

// ---- FUNGSI UNTUK MEMUAT SEMUA COMMAND SECARA OTOMATIS (VERSI SUB-FOLDER) ----
async function loadCommands() {
    const modulesPath = join(process.cwd(), 'modules');
    // Cek apakah folder modules ada, jika tidak, lewati untuk menghindari error
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
                    const commandModule = await import(`file://${join(fullPath, file)}`);
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
    if (!message.message || message.key.fromMe) return;

    const sender = message.key.remoteJid;

    // --- LOGIKA DETEKSI PESAN CERDAS (VERSI PERBAIKAN DENGAN CAPTION SUPPORT) ---
    // Variabel 'body' akan menampung teks perintah, dari mana pun asalnya.
    let body = '';
    const msg = message.message;

    if (msg.conversation) {
        body = msg.conversation;
    } else if (msg.extendedTextMessage) {
        body = msg.extendedTextMessage.text;
    } else if (msg.imageMessage?.caption) { // <-- PERBAIKAN 1: BACA CAPTION GAMBAR
        body = msg.imageMessage.caption;
    } else if (msg.videoMessage?.caption) { // <-- PERBAIKAN 2: BACA CAPTION VIDEO
        body = msg.videoMessage.caption;
    } else if (msg.buttonsResponseMessage) {
        body = msg.buttonsResponseMessage.selectedButtonId;
    } else if (msg.listResponseMessage) {
        body = msg.listResponseMessage.singleSelectReply?.selectedRowId;
    } else if (msg.templateButtonReplyMessage) {
        body = msg.templateButtonReplyMessage.selectedId;
    }
    // --------------------------------------------------------------------------
    
    const text = body; // 'text' adalah alias untuk 'body' untuk kompatibilitas
    if (!text) return; // Jika tidak ada konten teks yang bisa diproses, abaikan.

    // Logika waitState masih dipertahankan untuk command multi-langkah jika dibutuhkan
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

    const prefix = config.BOT_PREFIX;
    if (!text.startsWith(prefix)) return;

    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const commandModule = commands.get(commandName);
    
    const query = text.slice(prefix.length + commandName.length).trim();

    if (commandModule) {
        try {
            // ================== PERUBAHAN DI SINI ==================
            const extras = {
                commands, // <-- TAMBAHKAN BARIS INI untuk melewatkan map 'commands'
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
            // =======================================================
            
            await commandModule.default(sock, message, args, query, sender, extras);
        } catch (error) {
            console.error(`[EXECUTION ERROR] Command: ${commandName}`, error);
            sock.sendMessage(sender, { text: `Terjadi error saat menjalankan command: ${error.message}` }, { quoted: message });
        }
    }
};