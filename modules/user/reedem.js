// modules/user/redeem.js
import db from '../../libs/database.js';
import H from '../../helper.js';
import { config } from '../../config.js';

export default async function(sock, msg, args) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;
    const code = args[0]?.toUpperCase();

    if (!code) {
        return H.sendMessage(sock, sender, 'Gunakan format `.redeem KODE`', { quoted: msg });
    }

    const codeData = db.getCode(code);
    if (!codeData) {
        return H.sendMessage(sock, sender, '❌ Kode redeem tidak ditemukan atau tidak valid.', { quoted: msg });
    }

    if (codeData.used >= codeData.limit) {
        return H.sendMessage(sock, sender, '❌ Maaf, kuota penggunaan kode ini sudah habis.', { quoted: msg });
    }
    
    if (codeData.claimedBy.includes(senderId)) {
        return H.sendMessage(sock, sender, '❌ Kamu sudah pernah me-redeem kode ini.', { quoted: msg });
    }

    const isVip = db.isVip(senderId);
    if(codeData.vipOnly && !isVip) {
        return H.sendMessage(sock, sender, '❌ Kode ini hanya bisa di-redeem oleh pengguna VIP.', { quoted: msg });
    }

    const user = db.getUser(senderId);
    db.updateUser(senderId, { points: user.points + codeData.points });

    db.updateCode(code, {
        used: codeData.used + 1,
        claimedBy: [...codeData.claimedBy, senderId]
    });
    
    await H.sendMessage(sock, sender, `✅ Berhasil redeem kode! Kamu mendapatkan *${codeData.points} poin*.`, { quoted: msg });
}