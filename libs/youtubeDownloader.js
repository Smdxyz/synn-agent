import axios from 'axios';
import { sleep } from './utils.js'; // Asumsi kamu punya utils.js

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
];
const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

/**
 * Mengunduh audio dari URL YouTube menggunakan Szyrine API dengan pola job & status check.
 * @param {string} youtubeUrl URL video YouTube.
 * @param {function} onProgress Callback untuk melaporkan kemajuan, menerima string sebagai argumen.
 * @returns {Promise<{title: string, buffer: Buffer}>} Objek berisi judul dan buffer audio.
 */
export async function downloadYouTubeAudio(youtubeUrl, onProgress = () => {}) {
    try {
        await onProgress('⏳ Memulai permintaan unduh...');
        const initialApiUrl = `https://szyrineapi.biz.id/api/youtube/download/mp3?url=${encodeURIComponent(youtubeUrl)}`;
        const { data: initialData } = await axios.get(initialApiUrl, { timeout: 30000 });

        if (initialData.status !== 202 || !initialData.result.jobId) {
            throw new Error('Server gagal menerima permintaan unduh awal.');
        }

        const { jobId, statusCheckUrl } = initialData.result;
        await onProgress(`⏳ Pekerjaan diterima (ID: ${jobId.substring(0, 8)}). Memeriksa status...`);

        let finalResult = null;
        for (let i = 0; i < 30; i++) { // Coba selama ~2 menit (30 * 4 detik)
            await sleep(4000);
            const { data: statusData } = await axios.get(statusCheckUrl, { timeout: 15000 });
            const { result: jobDetails } = statusData;

            if (jobDetails?.status === 'completed') {
                finalResult = statusData;
                break;
            } else if (jobDetails?.status === 'failed') {
                throw new Error(jobDetails.message || 'Proses di server backend gagal.');
            } else if (jobDetails.message) {
                await onProgress(`⏳ ${jobDetails.message}`);
            }
        }

        if (!finalResult) {
            throw new Error('Waktu tunggu habis. Server mungkin sibuk atau video terlalu panjang.');
        }

        const { link, title } = finalResult.result.result;
        if (!link) throw new Error('API berhasil tapi tidak mengembalikan link download.');

        await onProgress('✅ Link didapat! Mengunduh audio...');
        const { data: audioBuffer } = await axios.get(link, {
            responseType: 'arraybuffer',
            timeout: 300000, // 5 menit
            headers: { 'User-Agent': getRandomUserAgent(), 'Referer': 'https://www.google.com/' }
        });

        return { title, buffer: audioBuffer };

    } catch (error) {
        console.error("[youtubeDownloader] Error:", error.message);
        // Lempar kembali error agar bisa ditangkap oleh modul yang memanggil
        throw error;
    }
}