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
    
    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    
    const replacements = {
        '{{NAMA_LENGKAP}}': studentData.fullName,
        '{{TANGGAL_LAHIR}}': moment(studentData.birthDate).format('DD MMMM YYYY'),
        '{{STUDENT_ID}}': studentData.studentId,
        '{{TANGGAL_SURAT}}': moment().format('DD MMMM YYYY'),
        '{{TAHUN_AKADEMIK}}': academicYear,
    };

    for (const [key, value] of Object.entries(replacements)) {
        htmlContent = htmlContent.replace(new RegExp(key, 'g'), value);
    }
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Argumen penting untuk server Linux
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
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