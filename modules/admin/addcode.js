// modules/admin/addcode.js
import { config } from '../../config.js';
import db from '../../libs/database.js';
import H from '../../helper.js';
import { v4 as uuidv4 } from 'uuid';

export default async function(sock, msg, args) {
    const sender = msg.key.remoteJid;
    // Ambil ID pengirim yang akurat (baik dari grup maupun PC)
    const senderId = msg.key.participant || msg.key.remoteJid;
    
    // --- LOGIKA PENGECEKAN OWNER YANG LEBIH KUAT ---
    
    // 1. Bersihkan ID pengirim (hapus @s.whatsapp.net dan kode device seperti :1)
    const senderNum = senderId.split('@')[0].split(':')[0];
    
    // 2. Ambil nomor owner dari config dan pastikan string
    const ownerNum = config.owner.toString();

    // 3. Debugging: Tampilkan di terminal siapa yang mencoba akses
    console.log(`[AUTH CHECK] Sender: ${senderNum} | Owner Config: ${ownerNum}`);

    // 4. Bandingkan angkanya saja
    if (senderNum !== ownerNum) {
        return H.sendMessage(sock, sender, `❌ Akses Ditolak!\n\nNomor Anda terdeteksi: *${senderNum}*\nOwner terdaftar: *${ownerNum}*\n\nSilakan ubah nomor di file config.js agar sama.`, { quoted: msg });
    }

    // --- BATAS PENGECEKAN OWNER ---

    // .addcode <points> <limit> [vip]
    const points = parseInt(args[0]);
    const limit = parseInt(args[1]);
    const vipOnly = args[2] === 'vip';

    if (isNaN(points) || isNaN(limit)) {
        return H.sendMessage(sock, sender, `Format salah.\nContoh: \n.addcode 100 10 (100 poin, 10x pakai)\n.addcode 500 1 vip (500 poin, 1x pakai, khusus VIP)`, { quoted: msg });
    }
    
    const code = uuidv4().split('-')[0].toUpperCase();
    const newCode = {
        code: code,
        points: points,
        limit: limit,
        used: 0,
        vipOnly: vipOnly,
        claimedBy: [],
        createdBy: senderNum
    };

    db.addCode(newCode);

    const replyText = `✅ Kode Redeem Berhasil Dibuat!\n\n` +
                      `- Kode: *${code}*\n` +
                      `- Poin: *${points}*\n` +
                      `- Limit: *${limit}x pakai*\n` +
                      `- Khusus VIP: *${vipOnly ? 'Ya' : 'Tidak'}*`;
    
    await H.sendMessage(sock, sender, replyText, { quoted: msg });
}