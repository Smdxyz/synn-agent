// modules/user/redeem.js
import db from '../../libs/database.js';
import H from '../../helper.js';
import { config } from '../../config.js';

export default async function(sock, msg, args) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;
    const normalizedSenderId = db.normalizeUserId(senderId);
    const code = args[0]?.toUpperCase();

    if (!code) {
        return H.sendMessage(sock, sender, 'Gunakan format `.redeem KODE`', { quoted: msg });
    }

    const codeData = db.getCode(code);
    if (!codeData) {
        return H.sendMessage(sock, sender, '❌ Kode redeem tidak ditemukan atau tidak valid.', { quoted: msg });
    }

    const usedCount = Number(codeData.used ?? 0);
    const limitCount = Number(codeData.limit ?? 0);
    if (limitCount <= 0) {
        return H.sendMessage(sock, sender, '❌ Kode redeem ini tidak memiliki batas penggunaan yang valid.', { quoted: msg });
    }

    if (usedCount >= limitCount) {
        return H.sendMessage(sock, sender, '❌ Maaf, kuota penggunaan kode ini sudah habis.', { quoted: msg });
    }
    
    const claimedBy = Array.isArray(codeData.claimedBy) ? codeData.claimedBy : [];
    if (claimedBy.includes(normalizedSenderId)) {
        return H.sendMessage(sock, sender, '❌ Kamu sudah pernah me-redeem kode ini.', { quoted: msg });
    }

    const isVip = db.isVip(normalizedSenderId);
    if(codeData.vipOnly && !isVip) {
        return H.sendMessage(sock, sender, '❌ Kode ini hanya bisa di-redeem oleh pengguna VIP.', { quoted: msg });
    }

    const reward = codeData.points ?? 0;
    if (reward <= 0) {
        return H.sendMessage(sock, sender, '❌ Kode redeem ini tidak memiliki reward yang valid.', { quoted: msg });
    }

    const user = db.getUser(normalizedSenderId);
    db.updateUser(normalizedSenderId, { points: user.points + reward });

    db.updateCode(code, {
        used: usedCount + 1,
        claimedBy: [...claimedBy, normalizedSenderId]
    });
    
    const remaining = limitCount - (usedCount + 1);
    await H.sendMessage(
        sock,
        sender,
        `✅ Berhasil redeem kode! Kamu mendapatkan *${reward} poin*.\nSisa kuota kode: *${remaining}*`,
        { quoted: msg }
    );
}

export const cost = 3;
