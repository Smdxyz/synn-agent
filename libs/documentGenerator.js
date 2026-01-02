// libs/documentGenerator.js
import puppeteer from 'puppeteer';
import moment from 'moment-timezone';
import { faker } from '@faker-js/faker';

// Data Sekolah Target (ASU - Arizona State University)
export const TARGET_SCHOOL = {
    id: 104152, // ID SheerID untuk ASU
    name: "Arizona State University",
    city: "Tempe, AZ"
};

// Fungsi generate data siswa
export function generateStudentData() {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    // ASU ID biasanya 10 digit angka
    const studentId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    
    // Umur mahasiswa (18-24 tahun)
    const birthDate = faker.date.birthdate({ min: 2000, max: 2005, mode: 'year' });

    return {
        firstName,
        lastName,
        fullName: `${lastName}, ${firstName}`.toUpperCase(), // Format transkrip biasanya Last, First
        birthDate,
        studentId,
        organization: TARGET_SCHOOL // Masukkan data sekolah ke objek siswa
    };
}

// Fungsi membuat Dokumen Transkrip (HTML to PDF)
export async function generateDocument(studentData) {
    // Tanggal cetak (Hari ini)
    const printDate = moment().tz('America/Phoenix').format('MM/DD/YYYY');
    
    // Semester Aktif (Spring 2025)
    const currentTerm = "Spring 2025";
    const termStart = "01/08/2025";
    const termEnd = "05/05/2025";

    // Template Transkrip ASU (Clean, Hitam Putih, Tabel Standar)
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @page { size: Letter; margin: 0.5in; }
            body { font-family: "Courier New", Courier, monospace; font-size: 11px; color: #000; line-height: 1.2; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .uni-name { font-size: 16px; font-weight: bold; }
            .sub-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .student-info { width: 60%; }
            .doc-info { width: 35%; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { text-align: left; border-bottom: 1px solid #000; font-weight: bold; padding: 2px 0; }
            td { padding: 2px 0; vertical-align: top; }
            .term-header { font-weight: bold; margin-top: 10px; text-decoration: underline; }
            .footer { border-top: 2px solid #000; margin-top: 30px; text-align: center; font-size: 10px; padding-top: 5px; }
            .watermark { position: fixed; top: 30%; left: 15%; font-size: 80px; color: rgba(0,0,0,0.05); transform: rotate(-45deg); z-index: -1; }
        </style>
    </head>
    <body>
        <div class="watermark">UNOFFICIAL TRANSCRIPT</div>
        
        <div class="header">
            <div class="uni-name">ARIZONA STATE UNIVERSITY</div>
            <div>University Registrar Services</div>
            <div>PO Box 870312, Tempe, AZ 85287</div>
        </div>

        <div class="sub-header">
            <div class="student-info">
                <div><strong>Name:</strong> ${studentData.fullName}</div>
                <div><strong>Student ID:</strong> ${studentData.studentId}</div>
                <div><strong>Birth Date:</strong> ${moment(studentData.birthDate).format('MM/DD/YYYY')}</div>
                <div><strong>Program:</strong> BS Computer Science</div>
                <div><strong>College:</strong> Ira A. Fulton Schools of Engineering</div>
            </div>
            <div class="doc-info">
                <div><strong>Date Issued:</strong> ${printDate}</div>
                <div><strong>Page:</strong> 1 of 1</div>
                <div><strong>Record Status:</strong> Good Standing</div>
            </div>
        </div>

        <div class="term-header">Term: Fall 2024 (Completed)</div>
        <table>
            <tr>
                <th width="15%">Course</th>
                <th width="50%">Description</th>
                <th width="10%">Att</th>
                <th width="10%">Ern</th>
                <th width="15%">Grade</th>
            </tr>
            <tr>
                <td>CSE 110</td>
                <td>Principles of Programming</td>
                <td>3.00</td>
                <td>3.00</td>
                <td>A</td>
            </tr>
            <tr>
                <td>MAT 265</td>
                <td>Calculus for Engineers I</td>
                <td>3.00</td>
                <td>3.00</td>
                <td>B+</td>
            </tr>
            <tr>
                <td>ENG 101</td>
                <td>First-Year Composition</td>
                <td>3.00</td>
                <td>3.00</td>
                <td>A-</td>
            </tr>
            <tr>
                <td>ASU 101</td>
                <td>The ASU Experience</td>
                <td>1.00</td>
                <td>1.00</td>
                <td>A</td>
            </tr>
        </table>
        <div><strong>Term GPA:</strong> 3.67</div>

        <div class="term-header">Term: ${currentTerm} (In Progress)</div>
        <div>Start Date: ${termStart} &nbsp;&nbsp; End Date: ${termEnd}</div>
        <table>
            <tr>
                <th width="15%">Course</th>
                <th width="50%">Description</th>
                <th width="10%">Att</th>
                <th width="10%">Ern</th>
                <th width="15%">Grade</th>
            </tr>
            <tr>
                <td>CSE 205</td>
                <td>Object-Oriented Prog & Data Struct</td>
                <td>3.00</td>
                <td>0.00</td>
                <td>IP</td>
            </tr>
            <tr>
                <td>MAT 266</td>
                <td>Calculus for Engineers II</td>
                <td>3.00</td>
                <td>0.00</td>
                <td>IP</td>
            </tr>
            <tr>
                <td>PHY 121</td>
                <td>University Physics I: Mechanics</td>
                <td>3.00</td>
                <td>0.00</td>
                <td>IP</td>
            </tr>
            <tr>
                <td>HST 101</td>
                <td>Global History to 1500</td>
                <td>3.00</td>
                <td>0.00</td>
                <td>IP</td>
            </tr>
        </table>
        <div><strong>Current Enrolled Hours:</strong> 12.00</div>

        <div class="footer">
            *** END OF ACADEMIC RECORD ***<br>
            This document is an unofficial transcript for verification purposes only.
        </div>
    </body>
    </html>
    `;
    
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
        
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // Mode Print untuk Transkrip
        await page.emulateMediaType('print');

        const pdfBuffer = await page.pdf({
            format: 'Letter', // Standar US pakai Letter, bukan A4
            printBackground: true,
            margin: {
                top: '0.4in',
                right: '0.4in',
                bottom: '0.4in',
                left: '0.4in'
            }
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