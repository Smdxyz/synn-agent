// modules/user/profile.js
import db from '../../libs/database.js';
import H from '../../helper.js';
import moment from 'moment-timezone';

export default async function(sock, msg) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;
    const normalizedSenderId = db.normalizeUserId(senderId);

    const user = db.getUser(normalizedSenderId);
    const isVip = db.isVip(normalizedSenderId);
    const vipStatus = isVip
        ? `✅ Aktif (sampai ${moment(user.vipUntil).tz('Asia/Jakarta').format('DD MMM YYYY, HH:mm')} WIB)`
        : '❌ Tidak Aktif';

    const profileText = `👤 *PROFIL ANDA*\n\n` +
                        `- Poin: *${user.points}*\n` +
                        `- Status VIP: ${vipStatus}\n` +
                        `\nGunakan poin untuk membeli VIP!`;
    
    await H.sendMessage(sock, sender, profileText, { quoted: msg });
}

export const cost = 3;
