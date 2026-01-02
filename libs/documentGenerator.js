// libs/documentGenerator.js
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import { faker } from '@faker-js/faker';

const templatePath = path.join(process.cwd(), 'templates', 'template.html');

// --- 1. DATA GENERATOR ---
export function generateStudentData() {
    const firstName = faker.person.firstName('male');
    const lastName = faker.person.lastName('male');
    const studentId = `5964${Math.floor(100 + Math.random() * 900)}`;
    const birthYear = Math.random() < 0.5 ? 2003 : 2004;
    const birthDate = faker.date.birthdate({ min: birthYear, max: birthYear, mode: 'year' });

    // Mata Kuliah untuk Schedule (International Business)
    const courses = [
        { code: "EBP802B05", name: "International Strategic Management", ec: 5 },
        { code: "EBP845B05", name: "Organizational Behaviour", ec: 5 },
        { code: "EBP822B05", name: "Finance and Risk Management", ec: 5 },
        { code: "EBP855B05", name: "Business Research Methods", ec: 5 },
        { code: "EBP860B05", name: "Global Supply Chain", ec: 5 }
    ];

    return {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.toUpperCase(),
        fullNameTitle: `${firstName} ${lastName}`,
        birthDate,
        studentId,
        courses
    };
}

// --- 2. HTML TEMPLATES (Embedded) ---

// Template A: Class Schedule
const getScheduleHTML = (data, dates) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
        .header { border-bottom: 2px solid #dc002d; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
        .logo { color: #dc002d; font-weight: bold; font-size: 24px; font-family: serif; }
        .title { font-size: 18px; font-weight: 600; text-transform: uppercase; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 14px; }
        .label { font-weight: bold; color: #666; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; background: #f4f4f4; padding: 12px; border-bottom: 2px solid #ddd; }
        td { padding: 12px; border-bottom: 1px solid #eee; }
        .footer { margin-top: 50px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
        .status { background: #e6f4ea; color: #1e8e3e; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">university of<br>groningen</div>
        <div class="title">Course Enrollment</div>
    </div>

    <div class="info-grid">
        <div>
            <div class="label">Student Name</div>
            <div>${data.fullName}</div>
        </div>
        <div>
            <div class="label">Student Number</div>
            <div>${data.studentId}</div>
        </div>
        <div>
            <div class="label">Programme</div>
            <div>BSc International Business</div>
        </div>
        <div>
            <div class="label">Academic Year</div>
            <div>${dates.academicYear}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Period</th>
                <th>EC</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${data.courses.map(c => `
            <tr>
                <td>${c.code}</td>
                <td>${c.name}</td>
                <td>Sem 1</td>
                <td>${c.ec}.0</td>
                <td><span class="status">ENROLLED</span></td>
            </tr>`).join('')}
        </tbody>
    </table>

    <div style="margin-top: 20px; text-align: right; font-weight: bold;">
        Total EC: 25.0
    </div>

    <div class="footer">
        Generated on ${dates.printDate} via ProgressWWW.<br>
        This document serves as proof of enrollment for the current academic period.
    </div>
</body>
</html>
`;

// Template B: Student ID Card (Realistis)
const getIdCardHTML = (data, dates) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; padding: 0; background: #fff; font-family: Arial, sans-serif; }
        .page-container { padding: 50px; display: flex; flex-direction: column; align-items: center; }
        /* Kartu Fisik */
        .card {
            width: 340px; height: 215px;
            border-radius: 12px;
            background: #fff;
            position: relative;
            overflow: hidden;
            border: 1px solid #eee;
            /* Efek print scan (tanpa shadow berlebihan) */
            outline: 1px solid #ddd;
        }
        .red-bar {
            position: absolute; top: 0; left: 0;
            width: 100%; height: 60px;
            background: #dc002d;
        }
        .uni-logo {
            position: absolute; top: 15px; left: 20px;
            color: white; font-weight: bold; font-family: serif; font-size: 16px;
            line-height: 1.1;
        }
        .photo-area {
            position: absolute; top: 80px; left: 20px;
            width: 80px; height: 100px;
            background: #e0e0e0;
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; color: #999;
            border: 1px solid #ccc;
        }
        .details {
            position: absolute; top: 80px; left: 120px;
            font-size: 12px; line-height: 1.6; color: #333;
        }
        .label { color: #dc002d; font-weight: bold; font-size: 10px; text-transform: uppercase; }
        .value { font-weight: bold; font-size: 13px; margin-bottom: 8px; display: block;}
        
        .valid-until {
            position: absolute; bottom: 15px; right: 20px;
            text-align: right;
        }
        .barcode {
            position: absolute; bottom: 15px; left: 20px;
            height: 20px; width: 100px; background: #000; /* Fake barcode block */
        }
    </style>
</head>
<body>
    <div class="page-container">
        <!-- Render Kartu di tengah kertas A4 -->
        <div class="card">
            <div class="red-bar"></div>
            <div class="uni-logo">university of<br>groningen</div>
            
            <div class="photo-area">
                STUDENT<br>PHOTO
            </div>

            <div class="details">
                <span class="label">Name</span>
                <span class="value">${data.fullNameTitle}</span>
                
                <span class="label">Student Number</span>
                <span class="value">${data.studentId}</span>

                <span class="label">Date of Birth</span>
                <span class="value">${moment(data.birthDate).format('DD-MM-YYYY')}</span>
            </div>

            <div class="valid-until">
                <span class="label">Valid Through</span>
                <span class="value">31-08-2026</span>
            </div>
            
            <div class="barcode"></div>
        </div>
        <div style="margin-top: 20px; color: #999; font-size: 12px;">Scanned Document - University Card</div>
    </div>
</body>
</html>
`;

// --- 3. GENERATOR ENGINE ---

async function createPdfFromHtml(html) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 }); // High DPI
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // Emulate Print & Clean PDF
        await page.emulateMediaType('print');
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
            pageRanges: '1',
            preferCSSPageSize: true
        });
        return pdfBuffer;
    } finally {
        if (browser) await browser.close();
    }
}

// FUNGSI UTAMA: Generate Invoice (Legacy)
async function generateInvoice(data, dates) {
    if (!fs.existsSync(templatePath)) throw new Error("Template invoice not found");
    let html = fs.readFileSync(templatePath, 'utf-8');
    
    // Clean CSS
    html = html.replace(/box-shadow:[^;]+;/g, 'box-shadow: none !important;');
    html = html.replace(/body\s*>\s*div\s*\{/g, 'body > div { border: none !important; margin: 0 !important;');

    const replacements = {
        '{{NAMA_LENGKAP}}': data.fullName,
        '{{TANGGAL_LAHIR}}': moment(data.birthDate).locale('en').format('D MMMM YYYY'),
        '{{STUDENT_ID}}': data.studentId,
        '{{TANGGAL_SURAT}}': dates.letterDate,
        '{{TAHUN_AKADEMIK}}': dates.academicYear,
    };

    for (const [key, value] of Object.entries(replacements)) {
        html = html.split(key).join(value);
    }
    return await createPdfFromHtml(html);
}

// EXPORT UTAMA: Random Document Generator
export async function generateRandomDocument(studentData) {
    // Config Tanggal Global
    const dates = {
        letterDate: "10 July 2025",
        academicYear: "2025-2026",
        printDate: moment().format('DD-MM-YYYY HH:mm')
    };

    // Randomizer (0: Invoice, 1: Schedule, 2: ID Card)
    // Bobot: Schedule dan ID Card lebih sering karena lebih kuat
    const types = ['invoice', 'schedule', 'schedule', 'idcard', 'idcard'];
    const selectedType = types[Math.floor(Math.random() * types.length)];

    console.log(`[DocGen] Generating Type: ${selectedType.toUpperCase()}`);

    let pdfBuffer;
    let docName;

    if (selectedType === 'invoice') {
        pdfBuffer = await generateInvoice(studentData, dates);
        docName = "Tuition_Invoice.pdf";
    } else if (selectedType === 'schedule') {
        const html = getScheduleHTML(studentData, dates);
        pdfBuffer = await createPdfFromHtml(html);
        docName = "Class_Schedule.pdf";
    } else { // idcard
        const html = getIdCardHTML(studentData, dates);
        pdfBuffer = await createPdfFromHtml(html);
        docName = "Student_ID.pdf";
    }

    return { buffer: pdfBuffer, type: selectedType, fileName: docName };
}