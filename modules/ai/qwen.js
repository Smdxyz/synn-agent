// /modules/ai/ai.js

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, react, editMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'AI';
export const description = 'Berinteraksi dengan Qwen AI. Mendukung percakapan berkelanjutan.';
export const usage = `${config.BOT_PREFIX}ai <pertanyaan>\n${config.BOT_PREFIX}ai reset (untuk memulai percakapan baru)`;
export const aliases = ['ask', 'qwen', 'synn'];

// Menyimpan ID sesi chat per pengguna di memori.
// Format: Map<userJid, chatId>
const chatSessions = new Map();

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args, query, sender) {
    if (!query) {
        return sendMessage(sock, sender, `Silakan berikan pertanyaan.\n\n*Contoh:*\n\`${config.BOT_PREFIX}ai Halo, siapa kamu?\`\n\nKetik \`${config.BOT_PREFIX}ai reset\` untuk memulai ulang sesi percakapan.`, { quoted: msg });
    }

    // Perintah untuk mereset sesi percakapan
    if (query.toLowerCase() === 'reset' || query.toLowerCase() === 'clear') {
        if (chatSessions.has(sender)) {
            chatSessions.delete(sender);
            return sendMessage(sock, sender, '✅ Sesi percakapan telah direset.', { quoted: msg });
        } else {
            return sendMessage(sock, sender, 'ℹ️ Tidak ada sesi percakapan aktif untuk direset.', { quoted: msg });
        }
    }

    await react(sock, sender, msg.key, '🤔');
    const waitingMsg = await sendMessage(sock, sender, `${config.botName} sedang berpikir...`, { quoted: msg });

    try {
        const apiParams = {
            q: query,
            // Sertakan API key jika ada di config
            ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
        };

        // Cek dan tambahkan chatId jika ada sesi sebelumnya untuk pengguna ini
        if (chatSessions.has(sender)) {
            apiParams.chatId = chatSessions.get(sender);
            console.log(`[AI] Melanjutkan sesi untuk ${sender} dengan chatId: ${apiParams.chatId}`);
        }

        const { data } = await axios.get('https://szyrineapi.biz.id/api/ai/qwen', {
            params: apiParams,
            timeout: 120000 // Timeout 2 menit, karena AI bisa merespons lambat
        });

        if (data.status !== 200 || !data.result?.success) {
            throw new Error(data.message || 'Gagal mendapatkan respons dari AI.');
        }

        const result = data.result.result;
        const responseContent = result.response.content;
        const newChatId = result.chatId;

        // Simpan atau perbarui chatId untuk sesi pengguna ini
        chatSessions.set(sender, newChatId);
        console.log(`[AI] Sesi baru/diperbarui untuk ${sender}. New chatId: ${newChatId}`);
        
        // Edit pesan "berpikir..." dengan jawaban dari AI
        await editMessage(sock, sender, responseContent, waitingMsg.key);

    } catch (error) {
        console.error("[AI_ERROR]", error);
        const errorMessage = error.response ? (error.response.data?.message || 'Server AI tidak merespon atau sedang sibuk.') : error.message;
        await editMessage(sock, sender, `❌ Maaf, terjadi kesalahan: ${errorMessage}`, waitingMsg.key);
    }
}