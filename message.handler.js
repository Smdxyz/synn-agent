// message.handler.js (FINAL & CLEAN VERSION)

import { readdirSync, statSync, existsSync, watch } from 'fs';
import { join, basename, extname } from 'path';
import { config } from './config.js';
import { settings } from './settings.js';
import db from './libs/database.js';
import paths from './libs/paths.js';

// ---- PENYIMPANAN COMMAND & STATE ----
export const commands = new Map();
const waitState = new Map();

// ---- FUNGSI UNTUK MEMUAT SATU COMMAND SECARA SPESIFIK (HOT RELOAD) ----
async function loadSingleCommand(filePath) {
    if (!filePath.endsWith('.js')) return;

    const commandName = basename(filePath, '.js');
    const backupCommand = commands.get(commandName);

    // Hapus command dan alias lama dari registry
    if (backupCommand) {
        commands.delete(commandName);
        const backupConfig = backupCommand.config || {};
        if (backupConfig.name) commands.delete(backupConfig.name);
        if (backupConfig.aliases && Array.isArray(backupConfig.aliases)) {
            backupConfig.aliases.forEach(alias => commands.delete(alias));
        }
    }

    // Cache-busting URL untuk ESM hot reload
    const cacheBuster = `?update=${Date.now()}`;
    const fileUrl = `file://${filePath}${cacheBuster}`;

    try {
        const originalModule = await import(fileUrl);
        const commandModule = { ...originalModule, filePath };

        const moduleConfig = commandModule.config || {};

        // Daftarkan nama asli file
        commands.set(commandName, commandModule);

        // Daftarkan nama dari config.name jika ada
        if (moduleConfig.name) {
            commands.set(moduleConfig.name, commandModule);
        }

        // Daftarkan aliases
        if (moduleConfig.aliases && Array.isArray(moduleConfig.aliases)) {
            moduleConfig.aliases.forEach(alias => commands.set(alias, commandModule));
        }
        console.log(`[HOT-RELOAD] Berhasil memuat: ${commandName}`);
    } catch (error) {
        console.error(`[HOT-RELOAD] Gagal memuat: ${commandName} -> ${error.message}`);
        // Restore backup jika gagal
        if (backupCommand) {
            commands.set(commandName, backupCommand);
            const backupConfig = backupCommand.config || {};
            if (backupConfig.name) {
                commands.set(backupConfig.name, backupCommand);
            }
            if (backupConfig.aliases && Array.isArray(backupConfig.aliases)) {
                backupConfig.aliases.forEach(alias => commands.set(alias, backupCommand));
            }
            console.log(`[HOT-RELOAD] Restoring versi lama untuk: ${commandName}`);
        }
    }
}

// ---- FUNGSI UNTUK MEMUAT SEMUA COMMAND AWAL ----
async function loadCommands() {
    const modulesPath = paths.modules;
    if (!existsSync(modulesPath)) {
        console.warn("[LOADER] Folder 'modules' tidak ditemukan.");
        return;
    }

    const loadDirectory = async (dir) => {
        const files = readdirSync(dir);
        for (const file of files) {
            const fullPath = join(dir, file);
            if (statSync(fullPath).isDirectory()) {
                await loadDirectory(fullPath);
            } else if (fullPath.endsWith('.js')) {
                await loadSingleCommand(fullPath);
            }
        }
    };

    await loadDirectory(modulesPath);
}

// ---- WATCHER FOLDER MODULES UNTUK HOT RELOAD ----
function watchModules() {
    const modulesPath = paths.modules;
    if (!existsSync(modulesPath)) return;

    let debounceTimeouts = new Map();
    let isReloading = new Set();

    watch(modulesPath, { recursive: true }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.js')) return;

        const fullPath = join(modulesPath, filename);

        // Prevent rapid execution
        if (debounceTimeouts.has(fullPath)) {
            clearTimeout(debounceTimeouts.get(fullPath));
        }

        debounceTimeouts.set(fullPath, setTimeout(async () => {
            debounceTimeouts.delete(fullPath);

            // Prevent concurrent loads for the same file
            if (isReloading.has(fullPath)) return;
            isReloading.add(fullPath);

            try {
                if (existsSync(fullPath)) {
                    // File ditambah atau diubah
                    await loadSingleCommand(fullPath);
                } else {
                    // File dihapus
                    const commandName = basename(filename, '.js');
                    const command = commands.get(commandName);
                    if (command) {
                        commands.delete(commandName);
                        const moduleConfig = command.config || {};
                        if (moduleConfig.name) commands.delete(moduleConfig.name);
                        if (moduleConfig.aliases && Array.isArray(moduleConfig.aliases)) {
                            moduleConfig.aliases.forEach(alias => commands.delete(alias));
                        }
                        console.log(`[HOT-RELOAD] Command dihapus: ${commandName}`);
                    }
                }
            } finally {
                isReloading.delete(fullPath);
            }
        }, 500)); // 500ms debounce
    });
    console.log("[HOT-RELOAD] Mengawasi folder modules untuk perubahan...");
}

// Panggil fungsi loader secara sinkron pada saat module diimport pertama kali
await loadCommands();
watchModules();


// ---- HANDLER UTAMA (DENGAN DETEKSI PESAN CERDAS) ----
export const handleMessage = async (sock, m) => {
    const message = m.messages[0];
    
    // Abaikan jika tidak ada konten pesan
    if (!message.message) return;

    // Helper untuk meresolve identitas pengirim dengan prioritas Baileys v7
    const getSenderId = (key) => {
        return key.participantAlt || key.participant || key.remoteJidAlt || key.remoteJid;
    };

    // Ambil pengaturan bot
    const botSettings = settings.get();

    // [FITUR] Kontrol self-response secara dinamis
    if (message.key.fromMe && !botSettings.allowSelfResponse) {
        return;
    }

    // --- [FITUR BARU] Mode Self (Hanya Owner yang bisa memberi perintah) ---
    // Dapatkan JID pengirim asli (berfungsi di grup dan PC) menggunakan helper baru
    const actualSender = getSenderId(message.key);
    const normalizedActualSender = db.normalizeUserId(actualSender);

    // Logika pengecekan owner yang mendukung PN dan LID
    const checkIsOwner = (normalizedId) => {
        const ownerPn = db.normalizeUserId(config.owner + '@s.whatsapp.net');
        const botId = sock.user?.id ? db.normalizeUserId(sock.user.id) : null;
        const botLid = sock.user?.lid ? db.normalizeUserId(sock.user.lid) : null;

        return normalizedId === ownerPn ||
               (botId && normalizedId === botId) ||
               (botLid && normalizedId === botLid);
    };
    
    // Jika selfMode aktif, bot hanya akan merespon perintah dari nomor owner.
    if (botSettings.selfMode && !checkIsOwner(normalizedActualSender)) {
        return; // Abaikan semua pesan dari orang lain
    }
    // --- Akhir Fitur Baru ---


    const sender = message.key.remoteJid; // JID untuk mengirim balasan (bisa grup/user)

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
            const senderId = getSenderId(message.key);
            const normalizedSenderId = db.normalizeUserId(senderId);
            const user = await db.getUser(normalizedSenderId);

            const isOwner = checkIsOwner(normalizedSenderId);
            const isGroup = sender.endsWith('@g.us');

            const moduleConfig = commandModule.config || {};

            // Cek IsOwner
            if (moduleConfig.isOwner && !isOwner) {
                return sock.sendMessage(sender, { text: `❌ Perintah ini hanya bisa digunakan oleh Owner.` }, { quoted: message });
            }

            // Cek isGroup
            if (moduleConfig.isGroup && !isGroup) {
                return sock.sendMessage(sender, { text: `❌ Perintah ini hanya bisa digunakan di dalam grup.` }, { quoted: message });
            }

            // Cost Checking
            const commandCost = Number.isFinite(moduleConfig.cost) ? moduleConfig.cost : 0;

            if (commandCost > 0 && (user.coins || 0) < commandCost) {
                return sock.sendMessage(
                    sender,
                    { text: `Koin kamu tidak cukup untuk fitur ini.\n- Biaya: *${commandCost} Koin*\n- Koin kamu: *${user.coins || 0}*` },
                    { quoted: message }
                );
            }

            // Helper reply object for the new execute logic
            const reply = (text, options = {}) => {
                return sock.sendMessage(sender, { text, ...options }, { quoted: message });
            };

            const context = {
                reply,
                sender: normalizedSenderId,
                query,
                command: commandName,
                isOwner,
                isGroup,
                commands,
                setWaitState: (userId, command, options) => {
                    waitState.set(userId, {
                        command: command,
                        handler: options.handler,
                        context: options.context || {},
                        timestamp: Date.now(),
                        timeout: options.timeout || 60000 
                    });
                },
            };

            if (typeof commandModule.execute === 'function') {
                await commandModule.execute(sock, m, args, context);
            } else if (typeof commandModule.default === 'function') {
                // Fallback for older modules if any exist
                await commandModule.default(sock, message, args, query, sender, context);
            } else {
                return sock.sendMessage(sender, { text: `Command ${commandName} tidak memiliki fungsi execute.` }, { quoted: message });
            }

            if (commandCost > 0) {
                await db.reduceCoins(normalizedSenderId, commandCost);
            }
        } catch (error) {
            console.error(`[EXECUTION ERROR] Command: ${commandName}\nSender: ${sender}\nError:`, error);
            sock.sendMessage(sender, { text: `❌ Terjadi kesalahan sistem saat menjalankan fitur ini. Silakan coba lagi nanti.` }, { quoted: message });
        }
    }
};
