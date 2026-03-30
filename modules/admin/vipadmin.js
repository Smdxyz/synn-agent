import db from '../../libs/database.js';
import moment from 'moment-timezone';

export const config = {
    name: 'vipadmin',
    aliases: ['addvip', 'delvip', 'setvip', 'cekvip'],
    description: 'Manajemen VIP User',
    usage: '.addvip @user <hari>',
    isOwner: true,
};

export const execute = async (sock, m, args, { reply, command }) => {
    if (args.length < 1) return reply(`Format salah!\nContoh: .${command} @user 30\nAtau reply pesan target.`);

    let target = '';
    if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        target = m.message.extendedTextMessage.contextInfo.participant;
    } else {
        return reply('Tag atau reply pesan user yang ingin diatur status VIP-nya.');
    }

    const userId = db.normalizeUserId(target);
    const days = parseInt(args[1]);
    const isVip = await db.isVip(userId);
    const user = await db.getUser(userId);

    if (command === 'cekvip') {
        if (isVip) {
            return reply(`Status VIP @${userId.split('@')[0]} aktif sampai: ${moment(user.vipUntil).tz('Asia/Jakarta').format('DD-MM-YYYY HH:mm')}`, { mentions: [target] });
        } else {
            return reply(`User @${userId.split('@')[0]} bukan anggota VIP.`, { mentions: [target] });
        }
    }

    if (command === 'addvip') {
        if (isNaN(days) || days <= 0) return reply('Masukkan jumlah hari yang valid (lebih dari 0).');
        await db.addVipDays(userId, days);
        const updated = await db.getUser(userId);
        return reply(`Berhasil menambahkan VIP selama ${days} hari ke @${userId.split('@')[0]}\nAktif sampai: ${moment(updated.vipUntil).tz('Asia/Jakarta').format('DD-MM-YYYY HH:mm')}`, { mentions: [target] });
    } else if (command === 'setvip') {
        if (isNaN(days) || days <= 0) return reply('Masukkan jumlah hari yang valid (lebih dari 0).');
        await db.updateUser(userId, { vipUntil: moment().add(days, 'days').toISOString() });
        const updated = await db.getUser(userId);
        return reply(`Berhasil mengatur VIP menjadi ${days} hari dari sekarang ke @${userId.split('@')[0]}\nAktif sampai: ${moment(updated.vipUntil).tz('Asia/Jakarta').format('DD-MM-YYYY HH:mm')}`, { mentions: [target] });
    } else if (command === 'delvip') {
        await db.removeVip(userId);
        return reply(`Status VIP untuk @${userId.split('@')[0]} berhasil dicabut.`, { mentions: [target] });
    }
};
