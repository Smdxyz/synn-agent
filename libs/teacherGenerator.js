// libs/teacherGenerator.js
import puppeteer from 'puppeteer';
import { faker } from '@faker-js/faker';
import { getRandomSchool } from './k12Data.js';

export function generateTeacherData() {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const school = getRandomSchool();
    
    // Guru biasanya umur 25-55 tahun
    const birthDate = faker.date.birthdate({ min: 1975, max: 1998, mode: 'year' });
    const teacherId = `T${Math.floor(10000 + Math.random() * 90000)}`;
    const email = faker.internet.email({ firstName, lastName });

    return {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        birthDate,
        email,
        school, // Objek sekolah lengkap (id, name, city)
        teacherId
    };
}

export async function generateTeacherBadge(teacherData) {
    const currentYear = new Date().getFullYear();
    const validYear = `${currentYear}-${currentYear + 1}`;

    // HTML Template ID Card (Mirip desain script Python: Hijau Forest)
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #fff; }
            .badge {
                width: 500px; height: 350px; border: 1px solid #ccc; position: relative;
                background: white; overflow: hidden;
            }
            .header {
                background: #228B22; /* Forest Green */
                height: 60px; color: white; display: flex;
                align-items: center; justify-content: center;
                font-size: 24px; font-weight: bold; letter-spacing: 1px;
            }
            .school-name {
                text-align: center; color: #228B22; font-size: 18px;
                margin-top: 15px; font-weight: bold; padding: 0 10px;
            }
            .content { display: flex; margin-top: 20px; padding: 0 25px; }
            .photo-box {
                width: 110px; height: 140px; border: 2px solid #ccc;
                display: flex; align-items: center; justify-content: center;
                color: #ccc; font-weight: bold; margin-right: 20px;
                background: #f9f9f9;
            }
            .details { display: flex; flex-direction: column; justify-content: center; font-size: 17px; line-height: 1.5; color: #333; }
            .validity {
                margin-top: 10px; font-size: 12px; color: #666; margin-left: 155px;
            }
            .footer {
                position: absolute; bottom: 0; width: 100%; height: 35px;
                background: #228B22; color: white; display: flex;
                align-items: center; justify-content: center; font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="badge">
            <div class="header">STAFF IDENTIFICATION</div>
            <div class="school-name">${teacherData.school.name}</div>
            <div class="content">
                <div class="photo-box">PHOTO</div>
                <div class="details">
                    <div><strong>Name:</strong> ${teacherData.fullName}</div>
                    <div><strong>ID:</strong> ${teacherData.teacherId}</div>
                    <div><strong>Position:</strong> Teacher</div>
                    <div><strong>Department:</strong> Education</div>
                    <div><strong>Status:</strong> Active</div>
                </div>
            </div>
            <div class="validity">Valid: ${validYear} School Year</div>
            <div class="footer">Property of School District</div>
        </div>
    </body>
    </html>
    `;

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
        });
        const page = await browser.newPage();
        
        // Set viewport pas ukuran badge
        await page.setViewport({ width: 500, height: 350, deviceScaleFactor: 2 });
        await page.setContent(htmlContent);
        
        // Screenshot jadi PNG (Buffer)
        const imageBuffer = await page.screenshot({ type: 'png' });
        return imageBuffer;
    } catch (error) {
        console.error("Badge generation failed:", error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}