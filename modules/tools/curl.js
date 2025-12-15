// /modules/tools/curl.js

import axios from 'axios';
import { sendMessage, sendDoc } from '../../helper.js';
import { config } from '../../config.js';

// --- METADATA COMMAND ---
export const category = 'Tools';
export const description = 'Menjalankan HTTP request (cURL) ke sebuah URL.';
export const usage = `${config.BOT_PREFIX}curl <METHOD> <URL> [JSON_DATA]`;
export const aliases = ['fetch', 'request'];

// --- FUNGSI UTAMA ---
export default async function curl(sock, msg, args, query, sender) {
    if (args.length < 2) {
        const example = `*GET Request:*\n\`${config.BOT_PREFIX}curl GET https://szyrineapi.biz.id/api/info/gempa\`\n\n` +
                        `*POST Request with data:*\n\`${config.BOT_PREFIX}curl POST https://example.com/api {"key":"value", "id":123}\``;
        return sendMessage(sock, sender, `Format penggunaan salah.\n\n${usage}\n\n${example}`, { quoted: msg });
    }

    const method = args[0].toUpperCase();
    const url = args[1];
    const dataStr = args.slice(2).join(' ');

    let postData = null;
    if (method === 'POST' && dataStr) {
        try {
            postData = JSON.parse(dataStr);
        } catch (e) {
            return sendMessage(sock, sender, `Data JSON yang Anda berikan tidak valid: ${e.message}`, { quoted: msg });
        }
    }
    
    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Menjalankan \`${method}\` request ke \`${url}\`...` }, { quoted: msg });

    try {
        const response = await axios({
            method: method,
            url: url,
            data: postData,
            headers: {
                // Menyamar sebagai browser umum
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            },
            timeout: 30000 // Timeout 30 detik
        });

        let responseBody;
        // Cek tipe respons, jika objek/array, format sebagai JSON. Jika bukan, sebagai teks.
        if (typeof response.data === 'object' && response.data !== null) {
            responseBody = JSON.stringify(response.data, null, 2); // JSON dengan indentasi
        } else {
            responseBody = String(response.data);
        }

        const headersStr = JSON.stringify(response.headers, null, 2);
        const fullResponse = `*✅ Status Code:* ${response.status} ${response.statusText}\n\n` +
                             `*--- RESPONSE HEADERS ---*\n\`\`\`json\n${headersStr}\n\`\`\`\n\n` +
                             `*--- RESPONSE BODY ---*\n\`\`\`\n${responseBody}\n\`\`\``;

        if (fullResponse.length > 3000) {
            await sendDoc(
                sock, 
                sender, 
                Buffer.from(fullResponse, 'utf-8'), 
                'curl_response.txt', 
                'text/plain', 
                { quoted: msg, caption: `Respons dari \`${url}\`:` }
            );
        } else {
            await sendMessage(sock, sender, fullResponse, { quoted: msg });
        }
        // Hapus pesan "processing..."
        await sock.sendMessage(sender, { delete: initialMsg.key });

    } catch (error) {
        let errorMsg;
        if (error.response) {
            // Server merespons dengan status error (4xx, 5xx)
            errorMsg = `*❌ Request Gagal*\n\n` +
                       `*Status:* ${error.response.status} ${error.response.statusText}\n` +
                       `*URL:* ${url}\n\n` +
                       `*Response Data:*\n\`\`\`\n${JSON.stringify(error.response.data, null, 2)}\n\`\`\``;
        } else if (error.request) {
            // Request dibuat tapi tidak ada respons (misal: timeout, network error)
            errorMsg = `*❌ Network Error*\n\nTidak ada respons yang diterima dari server.\nURL: ${url}\n\nError: ${error.message}`;
        } else {
            // Error lain saat setup request
            errorMsg = `*❌ Error*\n\nTerjadi kesalahan saat menyiapkan request:\n${error.message}`;
        }
        await sendMessage(sock, sender, errorMsg, { quoted: msg });
        await sock.sendMessage(sender, { delete: initialMsg.key });
    }
}