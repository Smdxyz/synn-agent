import db from '../../libs/database.js';

export const config = {
    name: 'coinadmin',
    aliases: ['addcoin', 'delcoin', 'setcoin', 'cekcoin'],
    description: 'Manajemen Koin User',
    usage: '.addcoin @user <jumlah>',
    isOwner: true,
};

export const execute = async (sock, m, args, { reply, command }) => {
    if (args.length < 1) return reply(`Format salah!\nContoh: .${command} @user 100\nAtau reply pesan target.`);

    // Ambil target (dari mention, reply, atau text argumen)
    let target = '';
    let amountIndex = 1;

    if (m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        target = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        target = m.message.extendedTextMessage.contextInfo.participant;
        amountIndex = 0; // Jika reply, argumen pertama (args[0]) adalah jumlahnya
    } else if (args[0] && args[0].includes('@') || args[0].replace(/[^0-9]/g, '').length >= 10) {
        // Fallback untuk plain text misal @628... atau 628...
        target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    } else {
        return reply('Tag, masukkan nomor, atau reply pesan user yang ingin diatur koinnya.');
    }

    const userId = db.normalizeUserId(target);
    const amount = parseInt(args[amountIndex]);

    if (command === 'cekcoin') {
        const user = await db.getUser(userId);
        return reply(`Koin user @${userId.split('@')[0]} saat ini: ${user.coins || 0}🪙`, { mentions: [target] });
    }

    if (isNaN(amount) || amount < 0) {
        return reply('Masukkan jumlah angka yang valid (lebih dari 0).');
    }

    if (command === 'addcoin') {
        await db.addCoins(userId, amount);
        reply(`Berhasil menambahkan ${amount} koin ke @${userId.split('@')[0]}`, { mentions: [target] });
    } else if (command === 'delcoin') {
        const result = await db.reduceCoins(userId, amount);
        if (result) {
            reply(`Berhasil mengurangi ${amount} koin dari @${userId.split('@')[0]}`, { mentions: [target] });
        } else {
            reply(`Gagal mengurangi koin. Koin @${userId.split('@')[0]} tidak mencukupi.`, { mentions: [target] });
        }
    } else if (command === 'setcoin') {
        await db.updateUser(userId, { coins: amount });
        reply(`Koin @${userId.split('@')[0]} berhasil diatur menjadi ${amount}🪙`, { mentions: [target] });
    }
};
