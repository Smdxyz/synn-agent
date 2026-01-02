// /modules/downloaders/scribd.js (ENDPOINT BARU)

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, sendDoc, editMessage, fetchAsBufferWithMime, react } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh dokumen dari Scribd sebagai file PDF.';
export const usage = `${config.BOT_PREFIX}scribd <url>`;
export const aliases = ['scdl'];

// --- FUNGSI UTAMA ---
export default async function scribd(sock, msg, args, query) {
    const url = query;
    const sender = msg.key.remoteJid;

    if (!url || !/scribd\.com/.test(url)) {
        return sendMessage(sock, sender, `Silakan berikan link Scribd yang valid.\n\n*Contoh:*\n\`${usage}\``, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Memproses link Scribd...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        await react(sock, sender, msg.key, '⏳');
        await editProgress('🔍 Meminta data dari API...');
        
        // <-- ENDPOINT DIPERBARUI
        const { data: apiResponse } = await axios.get('https://szyrineapi.biz.id/api/dl/scribd', {
            params: { 
                url,
                ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
            }
        });

        if (apiResponse.status !== 200 || !apiResponse.result?.success || !apiResponse.result.download_link) {
            throw new Error(apiResponse.result?.message || 'Gagal mendapatkan link unduhan dari API.');
        }

        const { title, download_link, pages } = apiResponse.result;
        
        await editProgress(`📥 Mengunduh dokumen *${title}* (${pages} halaman)... Ini mungkin memakan waktu.`);

        const { buffer } = await fetchAsBufferWithMime(download_link);
        const fileName = `${title.replace(/[^\w\s.-]/gi, '') || 'Scribd-Document'}.pdf`;

        await sendDoc(sock, sender, buffer, fileName, 'application/pdf', {
            quoted: msg,
        });

        await editProgress(`✅ Dokumen *${title}* berhasil dikirim!`);
        await react(sock, sender, msg.key, '✅');

    } catch (error) {
        console.error("[SCRIBD_ERROR]", error);
        await editProgress(`❌ Terjadi kesalahan: ${error.message}`);
        await react(sock, sender, msg.key, '❌');
    }
}

export const cost = 5;
