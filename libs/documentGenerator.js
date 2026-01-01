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
    
    // Student ID: 5964xxx
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
    
    // --- [1. CONFIG TANGGAL (HARDCODED)] ---
    const fixedLetterDate = "10 July 2025";
    const fixedAcademicYear = "2025-2026";
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

    // --- [2. PERBAIKAN: HAPUS GARIS/BAYANGAN MENGGANGGU] ---
    // Kita hapus CSS 'body > div' yang ada box-shadow nya
    htmlContent = htmlContent.replace(
        /body\s*>\s*div\s*\{[\s\S]*?\}/g, 
        'body > div { box-shadow: none !important; margin: 0 !important; border: none !important; }'
    );
    
    // Hapus juga background abu-abu jika ada di body
    htmlContent = htmlContent.replace('background-color', 'x-bg-color'); 
    
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
        
        // Ukuran A4 (Lebar x Tinggi)
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // Mode Print
        await page.emulateMediaType('print');

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, 
            margin: {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px'
            },
            pageRanges: '1',
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