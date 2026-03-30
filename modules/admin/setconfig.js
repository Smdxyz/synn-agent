import { configManager } from '../../libs/configManager.js';
import util from 'util';

export const config = {
    name: 'setconfig',
    aliases: ['config', 'cfg'],
    description: 'Ubah Konfigurasi Bot Permanen',
    usage: '.setconfig <key> <value>\nContoh: .setconfig botName "Bot Keren"',
    isOwner: true,
};

export const execute = async (sock, m, args, { reply }) => {
    if (args.length === 0) {
        const currentConfig = configManager.get();
        return reply(`*Konfigurasi Saat Ini:*\n\`\`\`json\n${JSON.stringify(currentConfig, null, 2)}\n\`\`\``);
    }

    if (args.length < 2) return reply('Format salah!\nGunakan: .setconfig <key> <value>');

    const key = args[0];
    const valueString = args.slice(1).join(' ');

    let parsedValue = valueString;
    // Coba parsing ke boolean/number/array/json jika memungkinkan
    try {
        if (valueString.toLowerCase() === 'true') parsedValue = true;
        else if (valueString.toLowerCase() === 'false') parsedValue = false;
        else if (!isNaN(Number(valueString))) parsedValue = Number(valueString);
        else if (valueString.startsWith('[') || valueString.startsWith('{')) {
            parsedValue = JSON.parse(valueString);
        }
    } catch (e) {
        // Biarkan sebagai string jika parse gagal
    }

    configManager.set(key, parsedValue);

    const updated = configManager.get();
    reply(`Konfigurasi berhasil diperbarui secara permanen!\nKey: ${key}\nValue: ${util.inspect(parsedValue)}`);
};
