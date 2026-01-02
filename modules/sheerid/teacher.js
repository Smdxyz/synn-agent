// modules/sheerid/teacher.js
import { config } from '../../config.js';
import H from '../../helper.js';
import db from '../../libs/database.js';
import { generateTeacherData, generateTeacherBadge } from '../../libs/teacherGenerator.js';
import { verifySheerID } from '../../libs/sheeridHandler.js';

const programIdRegex = /\/verify\/([a-f0-9]{24})\//;

export default async function (sock, msg, args) {
    const sender = msg.key.remoteJid;
    const senderId = msg.key.participant || sender;

    const link = args[0];
    if (!link || !programIdRegex.test(link)) {
        return H.sendMessage(sock, sender, `❌ Link SheerID tidak valid.\nCommand ini KHUSUS untuk K12 Teacher (Guru).\n\nContoh:\n${config.BOT_PREFIX}teacher https://services.sheerid.com/verify/68d47554aa292d20b9bec8f7/`, { quoted: msg });
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
        return H.sendMessage(sock, sender, `Poin kamu tidak cukup!\nButuh: *${cost} Poin*`, { quoted: msg });
    }

    const initialMsg = await H.sendMessage(sock, sender, '⏳ Mode: K12 Teacher Verification...', { quoted: msg });
    const edit = (text) => H.editMessage(sock, sender, text, initialMsg.key);

    try {
        await edit('👨‍🏫 Mengambil data sekolah K12 AS & Guru...');
        const teacherData = generateTeacherData();
        
        await edit(`🏫 Sekolah: ${teacherData.school.name}\n📸 Membuat ID Card (Badge)...`);
        const pngBuffer = await generateTeacherBadge(teacherData);

        await edit('🚀 Mengirim data ke SheerID (K12)...');
        
        const onProgress = (txt) => edit(`⏳ ${txt}`);

        // Panggil verifySheerID dengan tipe 'teacher'
        const result = await verifySheerID(programId, teacherData, pngBuffer, useProxy, onProgress, 'teacher');

        if (result.success) {
            db.updateUser(senderId, { points: user.points - cost });
            
            // Bonus referral
            if(user.referral.by) {
                const bonus = Math.floor(config.sheerid.verificationCost * config.sheerid.referralBonus);
                const inviter = db.getUser(user.referral.by);
                db.updateUser(user.referral.by, { points: inviter.points + bonus });
            }
            
            await edit(`✅ *TEACHER VERIFIED!*\n\n${result.message}\n\nInfo Guru:\nNama: ${teacherData.fullName}\nSekolah: ${teacherData.school.name}\nEmail: ${teacherData.email}`);
        } else {
            await edit(`❌ *VERIFIKASI GAGAL!*\n\nAlasan: ${result.message}`);
        }

    } catch (error) {
        console.error("Teacher command error:", error);
        await edit(`Error: ${error.message}`);
    }
}