import db from '../../libs/database.js';
import { config as botConfig } from '../../config.js';
import moment from 'moment-timezone';

export const config = {
    name: 'buyvip',
    aliases: ['belivip'],
    description: `Beli status VIP`, // Description updated since we can't safely string interpolate botConfig before it's loaded dynamically in some scenarios
    usage: '.buyvip',
    isGroup: false,
};

export const execute = async (sock, m, args, { reply, sender }) => {
    const userId = db.normalizeUserId(sender);
    const user = db.getUser(userId);
    const isVip = db.isVip(userId);
    const price = botConfig.coins.vipPrice;
    const durationDays = botConfig.coins.vipDurationDays;

    if (user.coins < price) {
        return reply(`❌ Koin Anda tidak mencukupi untuk membeli VIP.\n\n🎟 Harga VIP: ${price} 🪙\n💳 Koin Anda: ${user.coins} 🪙`);
    }

    const deducted = db.reduceCoins(userId, price);
    if (!deducted) return reply('❌ Gagal melakukan transaksi.');

    db.addVipDays(userId, durationDays);
    const updatedUser = db.getUser(userId);

    const activeUntil = moment(updatedUser.vipUntil).tz('Asia/Jakarta').format('DD-MM-YYYY HH:mm');
    reply(`✅ *Pembelian VIP Berhasil!*\n\nAnda telah menjadi member VIP.\nBerlaku sampai: ${activeUntil}\nSisa Koin: ${updatedUser.coins} 🪙`);
};
