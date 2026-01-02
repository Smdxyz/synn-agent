// modules/testing/testcard.js

// Ini adalah command untuk mengetes pengiriman 'cards' sesuai dokumentasi Ryuu311

export default async function(sock, message, args) {
    const sender = message.key.remoteJid;

    console.log('[TESTCARD] Mencoba mengirim pesan "cards" sesuai dokumentasi...');

    try {
        await sock.sendMessage(
            sender,
            {
                text: 'Body Message',
                title: 'Title Message',
                subtitle: 'Subtitle Message', // Typo 'subtile' dari doc sudah diperbaiki
                footer: 'Footer Message',
                cards: [
                   {
                      // Menggunakan gambar dari placeholder.com agar pasti bisa diakses
                      image: { url: 'http://szyrineapi.biz.id/uploads/12c87f805de7.jpg' },
                      title: 'Judul Kartu 1',
                      body: 'Ini adalah body text untuk kartu pertama.',
                      buttons: [
                          {
                              name: 'quick_reply',
                              buttonParamsJson: JSON.stringify({
                                 display_text: 'Tombol Balas',
                                 id: 'ID_BALAS_1'
                              })
                          },
                          {
                              name: 'cta_url',
                              buttonParamsJson: JSON.stringify({
                                 display_text: 'Buka Google',
                                 url: 'https://www.google.com'
                              })
                          }
                      ]
                   },
                   {
                      // Menggunakan gambar kedua yang berbeda
                      image: { url: 'http://szyrineapi.biz.id/uploads/12c87f805de7.jpg' },
                      title: 'Judul Kartu 2',
                      body: 'Ini adalah body text untuk kartu kedua.',
                      buttons: [
                          {
                              name: 'quick_reply',
                              buttonParamsJson: JSON.stringify({
                                 display_text: 'Tombol Balas 2',
                                 id: 'ID_BALAS_2'
                              })
                          }
                      ]
                   }
                ]
            },
            { quoted: message } // Kita quote biar tahu pesan mana yang dites
        );
        
        console.log('[TESTCARD] Pesan "cards" berhasil dikirim tanpa error.');

    } catch (error) {
        console.error('[TESTCARD] GAGAL mengirim "cards":', error);
        await sock.sendMessage(sender, { text: `Gagal mengirim "cards" dari dokumentasi. Error: ${error.message}` });
    }
}

export const cost = 1;
