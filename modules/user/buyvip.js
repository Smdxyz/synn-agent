// modules/user/buyvip.js
import db from '../../libs/database.js';
import H from '../../helper.js';
import { config } from '../../config.js';
import moment from 'moment-timezone';

export default async function(sock, msg) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;
    const normalizedSenderId = db.normalizeUserId(senderId);

    const user = db.getUser(normalizedSenderId);
    const price = config.points.vipPrice;
    const durationDays = config.points.vipDurationDays;

    if (user.points < price) {
        return H.sendMessage(sock, sender, `Poin kamu tidak cukup untuk membeli VIP.\n- Harga: *${price} Poin*\n- Poin kamu: *${user.points}*`, { quoted: msg });
    }

    const isVip = db.isVip(normalizedSenderId);
    let newVipUntil;

    if (isVip) {
        // Jika sudah VIP, perpanjang dari tanggal kadaluarsa
        newVipUntil = moment(user.vipUntil).add(durationDays, 'days');
    } else {
        // Jika belum, VIP mulai dari sekarang
        newVipUntil = moment().add(durationDays, 'days');
    }

    db.updateUser(normalizedSenderId, {
        points: user.points - price,
        vipUntil: newVipUntil.toISOString()
    });

    const formattedDate = newVipUntil.tz('Asia/Jakarta').format('DD MMMM YYYY, HH:mm');
    await H.sendMessage(
        sock,
        sender,
        `✅ Pembelian VIP berhasil! Akun kamu sekarang VIP selama ${durationDays} hari, berlaku hingga *${formattedDate} WIB*.`,
        { quoted: msg }
    );
}

export const cost = 3;
