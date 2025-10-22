// /modules/downloaders/scribd.js

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, sendDoc, editMessage, fetchAsBufferWithMime } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh dokumen dari Scribd sebagai file PDF.';
export const usage = `${config.BOT_PREFIX}scribd <url>`;
export const aliases = ['scdl'];

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args) {
    const url = args[0];
    const sender = msg.key.remoteJid;

    if (!url || !/scribd\.com/.test(url)) {
        return sendMessage(sock, sender, `Silakan berikan link Scribd yang valid.\n\n*Contoh:*\n\`${config.BOT_PREFIX}scribd https://www.scribd.com/document/...\``, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Memproses link Scribd...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        await editProgress('🔍 Meminta data dari API...');
        
        const { data: apiResponse } = await axios.get('https://szyrineapi.biz.id/api/downloaders/scribd', {
            params: { 
                url,
                ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
            }
        });

        if (apiResponse.status !== 200 || !apiResponse.result?.download_link) {
            throw new Error(apiResponse.message || 'Gagal mendapatkan link unduhan dari API.');
        }

        const { title, download_link, page_count } = apiResponse.result;
        
        await editProgress(`📥 Mengunduh dokumen *${title}* (${page_count} halaman)... Ini mungkin memakan waktu.`);

        const { buffer } = await fetchAsBufferWithMime(download_link);
        const fileName = `${title}.pdf`;

        await sendDoc(sock, sender, buffer, fileName, 'application/pdf', {
            quoted: msg,
            caption: `✅ Dokumen berhasil diunduh!\n\n*Judul:* ${title}\n*Jumlah Halaman:* ${page_count}`
        });

        await editProgress('✅ Dokumen berhasil dikirim!');

    } catch (error) {
        console.error("[SCRIBD_ERROR]", error);
        await editProgress(`❌ Terjadi kesalahan: ${error.message}`);
    }
}