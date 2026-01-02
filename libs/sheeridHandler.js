// libs/sheeridHandler.js
import axios from 'axios';
import { config } from '../config.js';
import H from '../helper.js';

const { proxies } = config.sheerid;

function getProxy() {
    if (proxies.length === 0) return null;
    return proxies[Math.floor(Math.random() * proxies.length)];
}

export async function verifySheerID(programId, studentData, pdfBuffer, useProxy, onProgress = () => {}) {
    const proxyConfig = useProxy ? getProxy() : null;
    const axiosInstance = axios.create({
        // Konfigurasi proxy bisa lebih kompleks jika diperlukan (misal: https-proxy-agent)
        // Untuk sekarang, kita asumsikan proxy http sederhana
        proxy: proxyConfig ? new URL(proxyConfig) : false,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/5.37.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-GB,en;q=0.9',
            'Origin': 'https://services.sheerid.com',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
        }
    });

    try {
        // --- STEP 1: Get Verification ID ---
        await onProgress('1/7: Memulai sesi verifikasi...');
        const initialUrl = `https://my.sheerid.com/rest/v2/verification/`;
        const initialPayload = {
            programId: programId,
            installPageUrl: `https://services.sheerid.com/verify/${programId}/`
        };
        const initialResponse = await axiosInstance.post(initialUrl, initialPayload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const verificationId = initialResponse.data.verificationId;
        if (!verificationId) throw new Error('Gagal mendapatkan verificationId.');
        console.log(`[SheerID] Verification ID: ${verificationId}`);

        // --- STEP 2: Submit Personal Info ---
        await onProgress('2/7: Mengirim data personal...');
        const personalInfoUrl = `https://services.sheerid.com/rest/v2/verification/${verificationId}/step/collectStudentPersonalInfo`;
        const personalInfoPayload = {
            firstName: studentData.firstName.toUpperCase(),
            lastName: studentData.lastName.toUpperCase(),
            birthDate: studentData.birthDate.toISOString().split('T')[0], // YYYY-MM-DD
            email: studentData.email,
            organization: { id: 327035, name: "Rijksuniversiteit Groningen (Groningen)" }, // Hardcoded sesuai log
            locale: "en-US",
            metadata: { marketConsentValue: false }
        };
        await axiosInstance.post(personalInfoUrl, personalInfoPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // --- STEP 3: Cancel SSO ---
        await onProgress('3/7: Melewati login SSO...');
        const cancelSsoUrl = `https://services.sheerid.com/rest/v2/verification/${verificationId}/step/sso?ssoMethod=INACADEMIA`;
        await axiosInstance.delete(cancelSsoUrl);
        
        // --- STEP 4: Get Upload URL ---
        await onProgress('4/7: Meminta link upload...');
        const getUploadUrl = `https://services.sheerid.com/rest/v2/verification/${verificationId}/step/docUpload`;
        const uploadUrlPayload = {
            files: [{ fileName: "document.pdf", mimeType: "application/pdf", fileSize: pdfBuffer.length }]
        };
        const uploadUrlResponse = await axiosInstance.post(getUploadUrl, uploadUrlPayload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const uploadUrl = uploadUrlResponse.data.documents[0]?.uploadUrl;
        if (!uploadUrl) throw new Error('Gagal mendapatkan URL untuk upload dokumen.');

        // --- STEP 5: Upload Document ---
        await onProgress('5/7: Mengunggah dokumen...');
        await axios.put(uploadUrl, pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Length': pdfBuffer.length
            }
        });

        // --- STEP 6: Complete Upload ---
        await onProgress('6/7: Menyelesaikan proses upload...');
        const completeUploadUrl = `https://services.sheerid.com/rest/v2/verification/${verificationId}/step/completeDocUpload`;
        await axiosInstance.post(completeUploadUrl, {}, {
            headers: { 'Content-Length': '0', 'Content-Type': 'application/json' }
        });
        
        // --- STEP 7: Polling for Status ---
        await onProgress('7/7: Menunggu hasil verifikasi (bisa sampai 1 menit)...');
        const statusUrl = `https://my.sheerid.com/rest/v2/verification/${verificationId}`;
        for (let i = 0; i < 15; i++) { // Coba selama 15x5 = 75 detik
            await H.sleep(5000);
            const statusResponse = await axiosInstance.get(statusUrl);
            const currentStep = statusResponse.data.currentStep;

            if (currentStep === "success") {
                return { success: true, message: "Verifikasi Berhasil! Silakan cek email Anda.", data: statusResponse.data };
            }
            if (statusResponse.data.rejectionReasons?.length > 0) {
                const reason = statusResponse.data.rejectionReasons.join(', ');
                throw new Error(`Verifikasi ditolak. Alasan: ${reason}`);
            }
        }
        
        throw new Error('Timeout. Hasil verifikasi tidak diterima dalam waktu yang ditentukan.');

    } catch (error) {
        console.error('[SheerID Handler Error]', error?.response?.data || error.message);
        const errorMessage = error?.response?.data?.message || error.message;
        return { success: false, message: `Proses gagal: ${errorMessage}` };
    }
}