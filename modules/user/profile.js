// modules/user/profile.js
import db from '../../libs/database.js';
import H from '../../helper.js';
import moment from 'moment-timezone';

export default async function(sock, msg) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;

    const user = db.getUser(senderId);
    const isVip = db.isVip(senderId);
    const vipStatus = isVip ? `✅ Aktif (sampai ${moment(user.vipUntil).tz('Asia/Jakarta').format('DD MMM YYYY, HH:mm')} WIB)` : '❌ Tidak Aktif';

    const profileText = `👤 *PROFIL ANDA*\n\n` +
                        `- Poin: *${user.points}*\n` +
                        `- Status VIP: ${vipStatus}\n` +
                        `- Teman Diundang: *${user.referral.count}* orang\n\n` +
                        `Gunakan poin untuk verifikasi atau beli VIP!`;
    
    await H.sendMessage(sock, sender, profileText, { quoted: msg });
}