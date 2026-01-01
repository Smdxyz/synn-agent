// modules/user/checkin.js
import db from '../../libs/database.js';
import H from '../../helper.js';
import { config } from '../../config.js';
import moment from 'moment-timezone';

export default async function(sock, msg) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;

    const user = db.getUser(senderId);
    const now = moment().tz('Asia/Jakarta');
    const lastCheckin = user.lastCheckin ? moment(user.lastCheckin).tz('Asia/Jakarta') : null;
    
    if (lastCheckin && now.isSame(lastCheckin, 'hour')) {
        const nextHour = lastCheckin.clone().add(1, 'hour').startOf('hour');
        return H.sendMessage(sock, sender, `Kamu sudah check-in di jam ini. Coba lagi setelah pukul *${nextHour.format('HH:00')} WIB*.`, { quoted: msg });
    }

    const pointsGained = config.sheerid.checkinPoints;
    db.updateUser(senderId, {
        points: user.points + pointsGained,
        lastCheckin: now.toISOString()
    });

    await H.sendMessage(sock, sender, `✅ Check-in berhasil! Kamu mendapatkan *${pointsGained} poin*.\nPoin kamu sekarang: *${user.points + pointsGained}*.`, { quoted: msg });
}