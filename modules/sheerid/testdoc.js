// modules/sheerid/testdoc.js
import H from '../../helper.js';
import { generateDocument, generateStudentData } from '../../libs/documentGenerator.js';

export default async function(sock, msg) {
    const sender = msg.key.remoteJid;
    await H.sendMessage(sock, sender, '⏳ Membuat dokumen tes...', { quoted: msg });

    try {
        const studentData = generateStudentData();
        const pdfBuffer = await generateDocument(studentData);

        const caption = `📄 *Dokumen Tes Dibuat*\n\nNama: *${studentData.fullName}*\nID: *${studentData.studentId}*\nLahir: *${studentData.birthDate.toLocaleDateString('id-ID')}*`;

        await H.sendDoc(sock, sender, pdfBuffer, 'dokumen-tes.pdf', 'application/pdf', { caption, quoted: msg });
    } catch (error) {
        console.error("Testdoc command error:", error);
        await H.sendMessage(sock, sender, `Gagal membuat dokumen: ${error.message}`, { quoted: msg });
    }
}