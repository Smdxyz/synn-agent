export const config = {
    name: 'ping',
    aliases: ['p'],
    description: 'Cek status dan respon bot',
    usage: '.ping',
    isOwner: false,
    isAdmin: false,
    isGroup: false,
};

export const execute = async (sock, m, args, { reply }) => {
    await reply('Pong! 🏓\nBot berjalan dengan normal.');
};
