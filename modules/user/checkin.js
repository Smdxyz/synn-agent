// modules/user/checkin.js
import moment from 'moment-timezone';
import db from '../../libs/database.js';
import H from '../../helper.js';
import { config } from '../../config.js';

export default async function(sock, msg) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;
    const normalizedSenderId = db.normalizeUserId(senderId);

    const user = db.getUser(normalizedSenderId);
    const now = moment().tz('Asia/Jakarta');
    const lastCheckin = user.lastCheckin ? moment(user.lastCheckin).tz('Asia/Jakarta') : null;

    if (lastCheckin && now.isSame(lastCheckin, 'hour')) {
        const nextHour = lastCheckin.clone().add(1, 'hour').startOf('hour');
        return H.sendMessage(sock, sender, `Kamu sudah check-in di jam ini. Coba lagi setelah pukul *${nextHour.format('HH:00')} WIB*.`, { quoted: msg });
    }

    const pointsGained = config.points.checkinPoints;
    db.updateUser(normalizedSenderId, {
        points: user.points + pointsGained,
        lastCheckin: now.toISOString()
    });

    await H.sendMessage(
        sock,
        sender,
        `✅ Check-in berhasil! Kamu mendapatkan *${pointsGained} poin*.\nPoin kamu sekarang: *${user.points + pointsGained}*.`,
        { quoted: msg }
    );
}

export const cost = 0;
