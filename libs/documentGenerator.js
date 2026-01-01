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
    
    // Logic tahun akademik (Contoh: Juli 2025 -> 2025-2026)
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;
    
    // Format tanggal surat (Contoh: 10 July 2025)
    const letterDate = moment().tz('Europe/Amsterdam').locale('en').format('D MMMM YYYY');

    const replacements = {
        '{{NAMA_LENGKAP}}': studentData.fullName,
        '{{TANGGAL_LAHIR}}': moment(studentData.birthDate).locale('en').format('D MMMM YYYY'),
        '{{STUDENT_ID}}': studentData.studentId,
        '{{TANGGAL_SURAT}}': letterDate,
        '{{TAHUN_AKADEMIK}}': academicYear,
    };

    for (const [key, value] of Object.entries(replacements)) {
        // Replace semua occurrence
        htmlContent = htmlContent.split(key).join(value);
    }
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Menghemat memory di server
                '--font-render-hinting=none' // Rendering font lebih presisi
            ] 
        });
        const page = await browser.newPage();
        
        // Set viewport A4 biar rendering HTML pas
        await page.setViewport({ width: 794, height: 1123 }); // Ukuran A4 dalam pixel (96 DPI)

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // [PERBAIKAN UTAMA DI SINI]
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // Wajib true agar background/warna muncul
            // Hapus margin default (ini biang keroknya jadi 2 halaman)
            margin: {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px'
            },
            // Paksa hanya ambil halaman 1 (jika ada overflow pixel sedikit)
            pageRanges: '1',
            // Sedikit scale down jika konten terlalu mepet, tapi margin 0 biasanya cukup
            scale: 1 
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