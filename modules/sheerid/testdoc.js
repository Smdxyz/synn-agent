// modules/sheerid/testdoc.js
import H from '../../helper.js';
import { generateRandomDocument, generateStudentData } from '../../libs/documentGenerator.js';

export default async function(sock, msg) {
    const sender = msg.key.remoteJid;
    await H.sendMessage(sock, sender, '⏳ Membuat 3 sampel dokumen...', { quoted: msg });

    try {
        const studentData = generateStudentData();
        
        // Loop 3 kali buat pamer ke user jenis-jenis dokumennya (tapi random)
        // Atau kita paksa generate satu aja biar cepet
        const docResult = await generateRandomDocument(studentData);

        const caption = `📄 *Dokumen Preview*\n\n` +
                        `Tipe: *${docResult.type.toUpperCase()}*\n` +
                        `File: *${docResult.fileName}*\n` +
                        `Nama: ${studentData.fullName}\n` +
                        `ID: ${studentData.studentId}`;

        await H.sendDoc(sock, sender, docResult.buffer, docResult.fileName, 'application/pdf', { caption, quoted: msg });
    } catch (error) {
        console.error("Testdoc error:", error);
        await H.sendMessage(sock, sender, `Gagal: ${error.message}`, { quoted: msg });
    }
}