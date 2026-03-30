import db from '../../libs/database.js';
import { config as botConfig } from '../../config.js';
import moment from 'moment-timezone';

export const config = {
    name: 'checkin',
    aliases: ['absen'],
    description: 'Ambil koin harian/jam gratis',
    usage: '.checkin',
    isGroup: false,
};

export const execute = async (sock, m, args, { reply, sender }) => {
    const userId = db.normalizeUserId(sender);
    const user = db.getUser(userId);
    const now = moment().tz('Asia/Jakarta');

    // Cek apakah sudah checkin di jam yang sama
    if (user.lastCheckin) {
        const last = moment(user.lastCheckin).tz('Asia/Jakarta');
        if (now.isSame(last, 'hour')) {
            const nextCheckin = moment(last).add(1, 'hour');
            const diffMin = nextCheckin.diff(now, 'minutes');
            return reply(`⏳ Anda sudah check-in.\nSilakan coba lagi dalam ${diffMin} menit.`);
        }
    }

    const checkinAmount = botConfig.coins.checkinCoins;
    db.addCoins(userId, checkinAmount);
    db.updateUser(userId, { lastCheckin: now.toISOString() });

    const updatedUser = db.getUser(userId);

    reply(`✅ *Check-in Berhasil!*\n\nAnda mendapatkan +${checkinAmount} Koin 🪙\nTotal Koin: ${updatedUser.coins} 🪙`);
};
