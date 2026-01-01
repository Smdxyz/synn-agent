// modules/user/buyvip.js
import db from '../../libs/database.js';
import H from '../../helper.js';
import { config } from '../../config.js';
import moment from 'moment-timezone';

export default async function(sock, msg) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;

    const user = db.getUser(senderId);
    const price = config.sheerid.vipPrice;

    if (user.points < price) {
        return H.sendMessage(sock, sender, `Poin kamu tidak cukup untuk membeli VIP.\n- Harga: *${price} Poin*\n- Poin kamu: *${user.points}*`, { quoted: msg });
    }

    const isVip = db.isVip(senderId);
    let newVipUntil;

    if (isVip) {
        // Jika sudah VIP, perpanjang dari tanggal kadaluarsa
        newVipUntil = moment(user.vipUntil).add(3, 'days');
    } else {
        // Jika belum, VIP mulai dari sekarang
        newVipUntil = moment().add(3, 'days');
    }

    db.updateUser(senderId, {
        points: user.points - price,
        vipUntil: newVipUntil.toISOString()
    });

    const formattedDate = newVipUntil.tz('Asia/Jakarta').format('DD MMMM YYYY, HH:mm');
    await H.sendMessage(sock, sender, `✅ Pembelian VIP berhasil! Akun kamu sekarang VIP selama 3 hari, berlaku hingga *${formattedDate} WIB*.`, { quoted: msg });
}