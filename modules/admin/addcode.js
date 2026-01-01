// modules/admin/addcode.js
import { config } from '../../config.js';
import db from '../../libs/database.js';
import H from '../../helper.js';
import { v4 as uuidv4 } from 'uuid';

export default async function(sock, msg, args) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;
    const ownerJid = `${config.owner}@s.whatsapp.net`;

    if (senderId !== ownerJid) {
        return H.sendMessage(sock, sender, '❌ Perintah ini hanya untuk Owner.', { quoted: msg });
    }

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
        createdBy: senderId
    };

    db.addCode(newCode);

    const replyText = `✅ Kode Redeem Berhasil Dibuat!\n\n` +
                      `- Kode: *${code}*\n` +
                      `- Poin: *${points}*\n` +
                      `- Limit: *${limit}x pakai*\n` +
                      `- Khusus VIP: *${vipOnly ? 'Ya' : 'Tidak'}*`;
    
    await H.sendMessage(sock, sender, replyText, { quoted: msg });
}