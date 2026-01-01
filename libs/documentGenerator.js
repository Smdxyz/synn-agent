// libs/documentGenerator.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import { faker } from '@faker-js/faker';

const templatePath = path.join(process.cwd(), 'templates', 'template.html');

// Fungsi untuk generate data siswa secara dinamis
export function generateStudentData() {
    const firstName = faker.person.firstName('male');
    const lastName = faker.person.lastName('male');
    
    // Student ID: 5964xxx (7 digit total, 3 digit terakhir random)
    const studentId = `5964${Math.floor(100 + Math.random() * 900)}`;
    
    // Tanggal Lahir: Tahun 2003 atau 2004
    // Format tanggal lahir di dokumen asli: "D MMMM YYYY" (tanpa nol di depan tanggal, misal 8 February 2003)
    const birthYear = Math.random() < 0.5 ? 2003 : 2004;
    const birthDate = faker.date.birthdate({ min: birthYear, max: birthYear, mode: 'year' });

    return {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.toUpperCase(),
        birthDate,
        studentId,
    };
}

// Fungsi untuk membuat dokumen PDF
export async function generateDocument(studentData) {
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found at ${templatePath}`);
    }

    let htmlContent = fs.readFileSync(templatePath, 'utf-8');
    
    // --- [PERBAIKAN TANGGAL HARDCODE SESUAI PERMINTAAN] ---
    // Tanggal Surat disamakan persis dengan contoh sukses: "10 July 2025"
    const fixedLetterDate = "10 July 2025";
    // Tahun Akademik disamakan persis: "2025-2026"
    const fixedAcademicYear = "2025-2026";

    // Format tanggal lahir (Locale Inggris, misal: 25 April 2004)
    const formattedDob = moment(studentData.birthDate).locale('en').format('D MMMM YYYY');

    const replacements = {
        '{{NAMA_LENGKAP}}': studentData.fullName,
        '{{TANGGAL_LAHIR}}': formattedDob,
        '{{STUDENT_ID}}': studentData.studentId,
        '{{TANGGAL_SURAT}}': fixedLetterDate,
        '{{TAHUN_AKADEMIK}}': fixedAcademicYear,
    };

    for (const [key, value] of Object.entries(replacements)) {
        htmlContent = htmlContent.split(key).join(value);
    }
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--font-render-hinting=none'
            ] 
        });
        const page = await browser.newPage();
        
        // [PERBAIKAN LAYOUT 1:1]
        // Kita set resolusi tinggi agar posisi elemen absolute tidak bergeser
        await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // Emulate media type 'print' agar CSS @media print di template bekerja sempurna
        await page.emulateMediaType('print');

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // Wajib true
            margin: {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px'
            },
            pageRanges: '1', // Paksa 1 Halaman
            // Prefer CSS Page Size agar ngikutin style @page dari HTML aslinya (jika ada)
            preferCSSPageSize: true 
        });

        return pdfBuffer;
    } catch (error) {
        console.error("[DocumentGenerator] Error creating PDF:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}