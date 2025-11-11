// libs/youtubeDownloader.js (FIXED - .buffer() error)

import got from 'got';
import { sleep, toBuffer } from './utils.js'; // <-- TAMBAHKAN 'toBuffer'
import { config } from '../config.js';

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/536.36',
];
const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

function createProgressBar(progress) {
    const totalBars = 15;
    const filledBars = Math.round((progress / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return `[${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}] ${progress.toFixed(0)}%`;
}

export async function downloadYouTubeAudio(youtubeUrl, onProgress = () => {}) {
    if (!config.SZYRINE_API_KEY || config.SZYRINE_API_KEY === "1") {
        throw new Error('SZYRINE_API_KEY belum diatur di config.js');
    }

    try {
        await onProgress('⏳ Memulai permintaan unduh...');
        const initialApiUrl = `https://szyrineapi.biz.id/api/dl/youtube/mp3?url=${encodeURIComponent(youtubeUrl)}&apikey=${config.SZYRINE_API_KEY}`;
        const initialData = await got(initialApiUrl, { timeout: { request: 30000 } }).json();

        if (initialData.result?.status === 'failed' || !initialData.result.jobId) {
             throw new Error(initialData.result?.message || 'Server gagal menerima permintaan unduh awal.');
        }
        
        const { jobId, statusCheckUrl } = initialData.result;
        await onProgress(`⏳ Pekerjaan diterima (ID: ${jobId.substring(0, 8)}). Memeriksa status...`);

        let finalResult = null;
        for (let i = 0; i < 45; i++) {
            await sleep(4000);
            const statusData = await got(statusCheckUrl, { timeout: { request: 15000 } }).json();
            const { result: jobDetails } = statusData;

            if (jobDetails?.status === 'completed') {
                finalResult = statusData;
                break;
            } else if (jobDetails?.status === 'failed') {
                throw new Error(jobDetails.message || 'Proses di server backend gagal.');
            } else if (jobDetails.message && (jobDetails.status === 'processing' || jobDetails.status === 'pending')) {
                const progress = jobDetails.progress || 0;
                await onProgress(`⏳ ${jobDetails.message}\n${createProgressBar(progress)}`);
            }
        }

        if (!finalResult) {
            throw new Error('Waktu tunggu habis. Server mungkin sibuk atau video terlalu panjang.');
        }

        const { link, title } = finalResult.result.result;
        if (!link) throw new Error('API berhasil tapi tidak mengembalikan link download.');

        await onProgress('✅ Link didapat! Mengunduh audio...');
        
        const downloadStream = got.stream(link, {
            headers: { 'User-Agent': getRandomUserAgent(), 'Referer': 'https://www.google.com/' }
        });

        downloadStream.on('downloadProgress', async (progress) => {
            const percent = progress.percent * 100;
            if (percent < 100) { // Hanya update jika belum selesai
                await onProgress(`📥 Mengunduh audio...\n${createProgressBar(percent)}`);
            }
        });

        // --- INI PERBAIKAN UTAMANYA ---
        // Gunakan fungsi toBuffer untuk mengubah stream menjadi buffer
        const audioBuffer = await toBuffer(downloadStream);

        return { title, buffer: audioBuffer };

    } catch (error) {
        console.error("[youtubeDownloader] Error:", error.message);
        throw error;
    }
}