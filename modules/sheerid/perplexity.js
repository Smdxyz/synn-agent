// modules/sheerid/perplexity.js
import { config } from '../../config.js';
import H from '../../helper.js';
import db from '../../libs/database.js';
import { faker } from '@faker-js/faker';
import { generateDocument, generateStudentData } from '../../libs/documentGenerator.js';
import { verifySheerID } from '../../libs/sheeridHandler.js';

const programIdRegex = /\/verify\/([a-f0-9]{24})\//;

export default async function (sock, msg, args) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;

    const link = args[0];
    if (!link || !programIdRegex.test(link)) {
        return H.sendMessage(sock, sender, `❌ Link SheerID tidak valid.\n\nContoh penggunaan:\n${config.BOT_PREFIX}perplexity https://services.sheerid.com/verify/681d40e03e7a8077098cb1b6/`, { quoted: msg });
    }

    const programId = link.match(programIdRegex)[1];
    const useProxy = args.includes('--proxy');
    
    const user = db.getUser(senderId);
    const isVip = db.isVip(senderId);

    // Hitung biaya
    let cost = isVip ? config.sheerid.verificationCost / 2 : config.sheerid.verificationCost;
    if (useProxy && !isVip) {
        cost += config.sheerid.proxyCost;
    }
    
    if (user.points < cost) {
        return H.sendMessage(sock, sender, `Poin kamu tidak cukup!\n\n- Poin saat ini: *${user.points} Poin*\n- Biaya verifikasi: *${cost} Poin*\n\nKumpulkan poin dengan `.checkin` atau `.redeem`.`, { quoted: msg });
    }

    const initialMsg = await H.sendMessage(sock, sender, '⏳ Mempersiapkan verifikasi...', { quoted: msg });
    const edit = (text) => H.editMessage(sock, sender, text, initialMsg.key);

    try {
        await edit('👤 Membuat data siswa...');
        const studentData = generateStudentData();
        studentData.email = faker.internet.email(); // Tambahkan email

        await edit('📄 Membuat dokumen PDF...');
        const pdfBuffer = await generateDocument(studentData);
        if (!pdfBuffer) throw new Error("Gagal membuat dokumen PDF.");

        await edit('🚀 Memulai proses verifikasi otomatis...');
        
        // Progress updater function
        const onProgress = (progressText) => {
            edit(`⏳ ${progressText}`);
        };

        const result = await verifySheerID(programId, studentData, pdfBuffer, useProxy, onProgress);

        if (result.success) {
            // Kurangi poin
            db.updateUser(senderId, { points: user.points - cost });
            
            // Tambahkan bonus referral jika ada
            if(user.referral.by) {
                const inviter = db.getUser(user.referral.by);
                const bonus = Math.floor(config.sheerid.verificationCost * config.sheerid.referralBonus);
                db.updateUser(user.referral.by, { points: inviter.points + bonus });
                await H.sendMessage(sock, user.referral.by, `🎉 Anda mendapatkan *${bonus} poin* dari referral!`);
            }
            
            await edit(`✅ *VERIFIKASI BERHASIL!*\n\n${result.message}\n\nPoin kamu terpotong: ${cost}`);
        } else {
            await edit(`❌ *VERIFIKASI GAGAL!*\n\nAlasan: ${result.message}\n\nPoin tidak dipotong.`);
        }

    } catch (error) {
        console.error("Perplexity command error:", error);
        await edit(`Terjadi error internal: ${error.message}`);
    }
}