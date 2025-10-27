// File: modules/scrapers/jkt48-official-scraper.js (FILE DIPERBAIKI)

import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://jkt48.com';

/**
 * Membersihkan dan memformat teks yang diekstrak dari Cheerio.
 * @param {import('cheerio').Cheerio<import('cheerio').Element>} element - Elemen Cheerio.
 * @returns {string} Teks yang sudah bersih.
 */
function cleanText(element) {
    if (!element || element.length === 0) return '';
    element.find('br').replaceWith('\n');
    return element.text().trim().replace(/\s\s+/g, ' ').replace(/\n /g, '\n');
}

/**
 * Mengambil daftar berita terbaru dari web resmi JKT48.
 * @returns {Promise<Array<object>>} Array objek berita.
 */
export async function getNewsList() {
    const url = `${BASE_URL}/news/list`;
    console.log(`[JKT48-SCRAPER] Mengambil daftar berita dari: ${url}`);
    try {
        const { body } = await gotScraping.get(url);
        const $ = cheerio.load(body);
        const newsList = [];
        $('.entry-news__list').each((i, el) => {
            const titleElement = $(el).find('.entry-news__list--item h3 a');
            newsList.push({
                title: cleanText(titleElement),
                url: `${BASE_URL}${titleElement.attr('href')}`,
                date: cleanText($(el).find('.entry-news__list--item time')),
                category: cleanText($(el).find('.entry-news__list--label p')) || 'Lainnya',
            });
        });
        return newsList;
    } catch (error) {
        console.error(`[JKT48-SCRAPER] Gagal mengambil daftar berita: ${error.message}`);
        throw error;
    }
}

/**
 * Mengambil detail dari satu artikel berita.
 * @param {string} rawNewsUrl - URL lengkap berita.
 * @returns {Promise<object>} Objek detail berita.
 */
export async function getNewsDetail(rawNewsUrl) {
    const newsUrl = rawNewsUrl.split('?')[0];
    console.log(`[JKT48-SCRAPER] Mengambil detail berita dari: ${newsUrl}`);
    try {
        const { body } = await gotScraping.get(newsUrl, { headers: { 'Referer': `${BASE_URL}/news/list` } });
        const $ = cheerio.load(body);
        const container = $('.entry-news__detail');
        return {
            title: cleanText(container.find('h3')),
            date: cleanText(container.find('.metadata2')),
            content: container.find('div').last().children('p').map((i, el) => cleanText($(el))).get().join('\n\n'),
        };
    } catch (error) {
        console.error(`[JKT48-SCRAPER] Gagal mengambil detail berita: ${error.message}`);
        throw error;
    }
}

/**
 * Mengambil jadwal teater dan event dari web resmi JKT48.
 * @returns {Promise<Array<object>>} Array objek jadwal.
 */
export async function getSchedule() {
    const url = `${BASE_URL}/calendar/list`;
    console.log(`[JKT48-SCRAPER] Mengambil jadwal dari: ${url}`);
    try {
        const { body } = await gotScraping.get(url);
        const $ = cheerio.load(body);
        const scheduleList = [];
        $('.entry-schedule__calendar table tbody tr').each((i, tr) => {
            const date = cleanText($(tr).find('h3')).replace(/\n/g, ' ').replace(/\s+/g, ' ');
            $(tr).find('.contents').each((j, content) => {
                const titleElement = $(content).find('p a');
                scheduleList.push({
                    date,
                    title: cleanText(titleElement),
                    url: `${BASE_URL}${titleElement.attr('href')}`
                });
            });
        });
        return scheduleList;
    } catch (error) {
        console.error(`[JKT48-SCRAPER] Gagal mengambil jadwal: ${error.message}`);
        throw error;
    }
}

/**
 * [FIXED] Mengambil detail dari sebuah jadwal (Teater, Event, atau Kalender Harian).
 * @param {string} rawScheduleUrl - URL lengkap dari jadwal.
 * @returns {Promise<object>} Objek berisi detail jadwal.
 */
export async function getScheduleDetail(rawScheduleUrl) {
    const scheduleUrl = rawScheduleUrl.split('?')[0];
    console.log(`[JKT48-SCRAPER] Mengambil detail jadwal dari: ${scheduleUrl}`);
    try {
        const { body } = await gotScraping.get(scheduleUrl, { headers: { 'Referer': `${BASE_URL}/calendar/list` } });
        const $ = cheerio.load(body);

        // [FIX 1] Kondisi diperbaiki menjadi lebih umum untuk menangkap URL teater
        if (scheduleUrl.includes('/theater/schedule/')) {
            console.log('[LOG] Tipe halaman terdeteksi: Pertunjukan Teater');
            const container = $('.entry-mypage__history table tbody tr');
            const members = [];
            $('th:contains("MEMBER")').closest('table').find('tbody tr td').last().find('a').each((i, el) => {
                members.push(cleanText($(el)));
            });
            return {
                type: 'Theater',
                title: cleanText(container.find('td').eq(1)),
                datetime: cleanText(container.find('td').eq(0)).replace(/\n/g, ' '),
                members: members,
            };
        } 
        // [FIX 1] Kondisi diperbaiki menjadi lebih umum untuk menangkap URL event
        else if (scheduleUrl.includes('/event/schedule/')) {
            console.log('[LOG] Tipe halaman terdeteksi: Event Spesial');
            const container = $('.entry-schedule__header');
            return {
                type: 'Special Event',
                title: cleanText(container.find('h2')),
                datetime: cleanText(container.find('p')),
            };
        } 
        // [FIX 2] Logika baru untuk menangani halaman kalender harian
        else if (scheduleUrl.includes('/calendar/list/')) {
            console.log('[LOG] Tipe halaman terdeteksi: Kalender Harian');
            const date = cleanText($('.entry-schedule__header--center'));
            const events = [];
            $('.entry-schedule__calendar .contents').each((i, el) => {
                const titleElement = $(el).find('p a');
                const title = cleanText(titleElement);
                const url = titleElement.attr('href');
                if (title && url) {
                    events.push({
                        title,
                        url: url.startsWith('http') ? url : `${BASE_URL}${url}`
                    });
                }
            });
            return {
                type: 'Calendar Day',
                date: date,
                events: events
            };
        }
        // Fallback jika tidak ada yang cocok
        else {
             throw new Error(`Tipe halaman jadwal tidak dikenali untuk URL: ${scheduleUrl}`);
        }
    } catch (error) {
        console.error(`[JKT48-SCRAPER] Gagal mengambil detail jadwal: ${error.message}`);
        throw error;
    }
}