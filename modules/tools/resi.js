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
const courierMap = {
    'j&t': 'JT', 'jt': 'JT', 'jet': 'JT',
    'jne': 'JNE',
    'sicepat': 'SiCepat',
    'sap': 'Sap',
    'idexpress': 'iDexpress',
    'ninja': 'Ninja',
    'lion': 'lion'
};

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args) {
    const sender = msg.key.remoteJid;
    const courier = args[0]?.toLowerCase();
    const resi = args[1];

    const supportedCouriers = `Kurir yang didukung:\n- spx (Shopee Express)\n- ${Object.keys(courierMap).join('\n- ')}`;
    const helpText = `Gunakan format:\n\`${config.BOT_PREFIX}resi <kurir> <nomor_resi>\`\n\n${supportedCouriers}`;

    if (!courier || !resi) {
        return sendMessage(sock, sender, helpText, { quoted: msg });
    }

    const initialMsg = await sock.sendMessage(sender, { text: `🚚 Melacak resi ${resi} via ${courier.toUpperCase()}...` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        let resultText;
        const apiParams = {
            ...(config.SZYRINE_API_KEY && { apikey: config.SZYRINE_API_KEY })
        };

        if (courier === 'spx' || courier === 'shopee') {
            const { data } = await axios.get('https://szyrineapi.biz.id/api/tools/trackers/spx', {
                params: { resi, ...apiParams }
            });
            if (data.status !== 200) throw new Error(data.message);
            
            const { trackingNumber, latestStatus, history } = data.result;
            resultText = `📦 *Status Paket ${trackingNumber}*\n\n*Status Terkini:* ${latestStatus.status}\n*Keterangan:* ${latestStatus.description}\n*Waktu:* ${latestStatus.dateTime}\n\n*Riwayat Perjalanan:*\n`;
            resultText += history.slice(0, 7).map(h => `\n- *${h.status}*\n  └ ${h.description}\n  📍 ${h.location}\n  🕒 ${h.dateTime}`).join('\n');
            if (history.length > 7) resultText += '\n\n_(Menampilkan 7 riwayat terbaru)_';

        } else {
            const courierCode = courierMap[courier];
            if (!courierCode) throw new Error(`Kurir "${courier}" tidak didukung.\n\n${supportedCouriers}`);

            const { data } = await axios.get('https://szyrineapi.biz.id/api/tools/trackers/universal', {
                params: { resi, kurir: courierCode, ...apiParams }
            });
            if (data.status !== 200) throw new Error(data.message);

            const { summary, details, history } = data.result;
            resultText = `📦 *Status Paket ${summary.trackingNumber} (${summary.courier})*\n\n*Status:* ${summary.status}\n*Update:* ${summary.lastUpdate}\n\n*Pengirim:* ${details.sender}\n*Penerima:* ${details.receiver}\n\n*Riwayat Perjalanan:*\n`;
            resultText += history.slice(0, 7).map(h => `\n- *${h.status}*\n  📍 ${h.location}\n  🕒 ${h.dateTime}`).join('\n');
            if (history.length > 7) resultText += '\n\n_(Menampilkan 7 riwayat terbaru)_';
        }
        
        await editProgress(resultText);

    } catch (error) {
        console.error("[RESI_ERROR]", error);
        await editProgress(`❌ Gagal melacak resi: ${error.message}`);
    }
}