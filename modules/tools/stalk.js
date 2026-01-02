// /modules/tools/stalk.js

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, editMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Tools';
export const description = 'Cek nickname pemain Mobile Legends atau Free Fire berdasarkan ID.';
export const usage = `${config.BOT_PREFIX}stalk <game> <id> [zone_id]`;
export const aliases = ['cekid'];

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args) {
    const sender = msg.key.remoteJid;
    const game = args[0]?.toLowerCase();
    const id = args[1];
    const zoneId = args[2];

    const helpText = `Silakan gunakan format yang benar:\n\n*Mobile Legends:*\n\`${config.BOT_PREFIX}stalk ml <userId> <zoneId>\`\n\n*Free Fire:*\n\`${config.BOT_PREFIX}stalk ff <playerId>\``;

    if (!game || !id) {
        return sendMessage(sock, sender, helpText, { quoted: msg });
    }
    
    let apiUrl, apiParams, gameName;

    if (game === 'ml' || game === 'mobilelegends') {
        if (!zoneId) return sendMessage(sock, sender, `Zone ID untuk Mobile Legends diperlukan.\n\n*Contoh:*\n\`${config.BOT_PREFIX}stalk ml 12345678 1234\``, { quoted: msg });
        gameName = 'Mobile Legends';
        apiUrl = 'https://szyrineapi.biz.id/api/tools/stalk/ml';
        apiParams = { userId: id, zoneId };
    } else if (game === 'ff' || game === 'freefire') {
        gameName = 'Free Fire';
        apiUrl = 'https://szyrineapi.biz.id/api/tools/stalk/ff';
        apiParams = { playerId: id };
    } else {
        return sendMessage(sock, sender, `Game "${game}" tidak didukung. Pilih 'ml' atau 'ff'.`, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: `🔍 Mencari data pemain ${gameName}...` }, { quoted: msg });
    
    try {
        if (config.SZYRINE_API_KEY) {
            apiParams.apikey = config.SZYRINE_API_KEY;
        }

        const { data: apiResponse } = await axios.get(apiUrl, { params: apiParams });

        if (apiResponse.status !== 200 || !apiResponse.result?.nickname) {
            throw new Error(apiResponse.message || 'Pemain tidak ditemukan.');
        }

        const { nickname, region } = apiResponse.result;

        const resultText = `✅ *Data Pemain Ditemukan!*\n\n*Game:* ${gameName}\n*Nickname:* ${nickname}\n*Region:* ${region}`;
        await editMessage(sock, sender, resultText, initialMsg.key);

    } catch (error) {
        console.error("[STALK_ERROR]", error);
        await editMessage(sock, sender, `❌ Gagal mencari pemain: ${error.message}`, initialMsg.key);
    }
}

export const cost = 2;
