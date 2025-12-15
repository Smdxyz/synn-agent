// /modules/tools/set.js

import { sendMessage } from '../../helper.js';
import { config } from '../../config.js';
import { settings } from '../../settings.js';

// --- METADATA COMMAND ---
export const category = 'Owner';
export const description = 'Mengaktifkan atau menonaktifkan fitur self-response bot.';
export const usage = `${config.BOT_PREFIX}set <on|off>`;
export const aliases = ['settings'];

// --- FUNGSI UTAMA ---
export default async function set(sock, msg, args, query, sender) {
    // Keamanan: Hanya owner yang bisa menjalankan command ini
    const senderNum = sender.split('@')[0];
    if (senderNum !== config.owner) {
        return sendMessage(sock, sender, "❌ Perintah ini hanya bisa digunakan oleh Owner Bot.", { quoted: msg });
    }

    const action = args[0]?.toLowerCase();

    if (action !== 'on' && action !== 'off') {
        const currentSettings = settings.get();
        const currentStatus = currentSettings.allowSelfResponse ? 'AKTIF' : 'NONAKTIF';
        return sendMessage(
            sock, 
            sender, 
            `Status self-response saat ini: *${currentStatus}*\n\nGunakan format:\n\`${usage}\`\n\n*Contoh:*\n.set on\n.set off`, 
            { quoted: msg }
        );
    }

    try {
        const newValue = (action === 'on'); // 'on' -> true, 'off' -> false
        settings.set('allowSelfResponse', newValue);

        const status = newValue ? 'DIAKTIFKAN' : 'DINONAKTIFKAN';
        await sendMessage(sock, sender, `✅ Fitur self-response berhasil *${status}*.`, { quoted: msg });
        
    } catch (error) {
        console.error("[SET_COMMAND_ERROR]", error);
        await sendMessage(sock, sender, `Terjadi error saat mengubah pengaturan: ${error.message}`, { quoted: msg });
    }
}