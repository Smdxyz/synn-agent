// modules/sheerid/perplexity.js
import { config } from '../../config.js';
import H from '../../helper.js';
import db from '../../libs/database.js';
import { faker } from '@faker-js/faker';
import { generateRandomDocument, generateStudentData } from '../../libs/documentGenerator.js'; // IMPORT BARU
import { verifySheerID } from '../../libs/sheeridHandler.js';

const programIdRegex = /\/verify\/([a-f0-9]{24})\//;

export default async function (sock, msg, args) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;

    const link = args[0];
    if (!link || !programIdRegex.test(link)) {
        return H.sendMessage(sock, sender, `❌ Link SheerID tidak valid.\nContoh: ${config.BOT_PREFIX}perplexity https://services.sheerid.com/verify/...`, { quoted: msg });
    }

    const programId = link.match(programIdRegex)[1];
    const useProxy = args.includes('--proxy');
    
    const user = db.getUser(senderId);
    const isVip = db.isVip(senderId);

    let cost = isVip ? config.sheerid.verificationCost / 2 : config.sheerid.verificationCost;
    if (useProxy && !isVip) cost += config.sheerid.proxyCost;
    
    if (user.points < cost) {
        return H.sendMessage(sock, sender, `Poin kurang! Butuh: *${cost} Poin*.`, { quoted: msg });
    }

    const initialMsg = await H.sendMessage(sock, sender, '⏳ Memulai proses...', { quoted: msg });
    const edit = (text) => H.editMessage(sock, sender, text, initialMsg.key);

    try {
        await edit('👤 Generate data siswa...');
        const studentData = generateStudentData();
        studentData.email = faker.internet.email();

        // --- [NEW] GENERATE RANDOM DOCUMENT ---
        await edit('📄 Membuat dokumen acak (ID/Jadwal/Invoice)...');
        const docResult = await generateRandomDocument(studentData);
        
        await edit(`📂 Dokumen Terpilih: *${docResult.fileName}*\n🚀 Mengupload ke SheerID...`);
        
        const onProgress = (txt) => edit(`⏳ [${docResult.type.toUpperCase()}] ${txt}`);

        // Kirim buffer dari result generator
        const result = await verifySheerID(programId, studentData, docResult.buffer, useProxy, onProgress);

        if (result.success) {
            db.updateUser(senderId, { points: user.points - cost });
            if(user.referral.by) {
                const bonus = Math.floor(config.sheerid.verificationCost * config.sheerid.referralBonus);
                db.updateUser(user.referral.by, { points: db.getUser(user.referral.by).points + bonus });
            }
            await edit(`✅ *VERIFIKASI BERHASIL!*\n\n${result.message}\n\nDokumen: ${docResult.fileName}`);
        } else {
            await edit(`❌ *VERIFIKASI GAGAL!*\n\nAlasan: ${result.message}`);
        }

    } catch (error) {
        console.error("Perplexity error:", error);
        await edit(`Error: ${error.message}`);
    }
}