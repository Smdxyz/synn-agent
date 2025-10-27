// /modules/tools/resi.js

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, editMessage } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Tools';
export const description = 'Melacak paket berdasarkan nomor resi dari berbagai kurir.';
export const usage = `${config.BOT_PREFIX}resi <kurir> <nomor_resi>`;
export const aliases = ['cekresi', 'track'];

// --- MAP KURIR UNTUK API UNIVERSAL ---
// Menambahkan spx/shopee ke dalam map untuk endpoint terpadu
const courierMap = {
    'j&t': 'JT', 'jt': 'JT', 'jet': 'JT',
    'jne': 'JNE',
    'sicepat': 'SiCepat',
    'sap': 'Sap',
    'idexpress': 'iDexpress',
    'ninja': 'Ninja',
    'lion': 'lion',
    'spx': 'SPX', 'shopee': 'SPX'
};

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args) {
    const sender = msg.key.remoteJid;
    const courier = args[0]?.toLowerCase();
    const resi = args[1];

    // Teks bantuan sekarang sepenuhnya dinamis dari courierMap
    const supportedCouriers = `Kurir yang didukung:\n- ${Object.keys(courierMap).join('\n- ')}`;
    const helpText = `Gunakan format:\n\`${config.BOT_PREFIX}resi <kurir> <nomor_resi>\`\n\n${supportedCouriers}`;

    if (!courier || !resi) {
        return sendMessage(sock, sender, helpText, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: `🚚 Melacak resi ${resi} via ${courier.toUpperCase()}...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        // Cek apakah kurir didukung dari courierMap
        const courierCode = courierMap[courier];
        if (!courierCode) {
            throw new Error(`Kurir "${courier}" tidak didukung.\n\n${supportedCouriers}`);
        }

        const apiParams = {
            resi,
            kurir: courierCode,
            ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
        };

        // Menggunakan endpoint baru yang terpadu untuk semua kurir
        const { data } = await axios.get('https://szyrineapi.biz.id/api/tools/track/package', {
            params: apiParams
        });
        
        if (data.status !== 200) {
            throw new Error(data.message || 'Gagal mengambil data dari API.');
        }

        // Parsing response dari format baru
        const { summary, history, courier: courierName } = data.result;

        let resultText = `📦 *Status Paket ${summary.trackingNumber} (${courierName})*\n\n`;
        resultText += `*Status Terkini:* ${summary.status}\n`;
        resultText += `*Update Terakhir:* ${summary.lastUpdate}\n\n`;
        resultText += `*Riwayat Perjalanan:*\n`;

        // Format riwayat perjalanan dengan detail deskripsi yang tersedia di API baru
        resultText += history.slice(0, 7).map(h => 
            `\n- *${h.status}*` +
            `\n  └ ${h.description}` +
            `\n  📍 ${h.location}` +
            `\n  🕒 ${h.dateTime}`
        ).join('\n');

        if (history.length > 7) {
            resultText += '\n\n_(Menampilkan 7 riwayat terbaru)_';
        }
        
        await editProgress(resultText);

    } catch (error) {
        console.error("[RESI_ERROR]", error);
        // Memberikan pesan error yang lebih informatif
        const errorMessage = error.response?.data?.message || error.message;
        await editProgress(`❌ Gagal melacak resi: ${errorMessage}`);
    }
}