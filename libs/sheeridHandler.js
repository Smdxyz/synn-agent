// libs/sheeridHandler.js
import axios from 'axios';
import { config } from '../config.js';
import H from '../helper.js';

const { proxies } = config.sheerid;

function getProxy() {
    if (!proxies || proxies.length === 0) return null;
    return proxies[Math.floor(Math.random() * proxies.length)];
}

// Tambahkan parameter 'type' (default 'student')
export async function verifySheerID(programId, userData, fileBuffer, useProxy, onProgress = () => {}, type = 'student') {
    const proxyConfig = useProxy ? getProxy() : null;
    const axiosInstance = axios.create({
        proxy: proxyConfig ? new URL(proxyConfig) : false,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/5.37.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://services.sheerid.com',
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
        
        console.log(`[SheerID-${type}] ID: ${verificationId} | User: ${userData.fullName}`);

        // --- STEP 2: Submit Personal Info ---
        await onProgress('2/7: Mengirim data personal...');
        
        let personalInfoUrl, personalInfoPayload;

        if (type === 'teacher') {
            // LOGIKA UNTUK TEACHER (K12)
            personalInfoUrl = `https://services.sheerid.com/rest/v2/verification/${verificationId}/step/collectTeacherPersonalInfo`;
            personalInfoPayload = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                birthDate: userData.birthDate.toISOString().split('T')[0],
                email: userData.email,
                phoneNumber: "",
                organization: { 
                    id: userData.school.id, 
                    idExtended: String(userData.school.id), // ID Extended wajib string
                    name: userData.school.name 
                },
                locale: "en-US",
                metadata: { marketConsentValue: false }
            };
        } else {
            // LOGIKA DEFAULT (STUDENT)
            personalInfoUrl = `https://services.sheerid.com/rest/v2/verification/${verificationId}/step/collectStudentPersonalInfo`;
            personalInfoPayload = {
                firstName: userData.firstName.toUpperCase(),
                lastName: userData.lastName.toUpperCase(),
                birthDate: userData.birthDate.toISOString().split('T')[0],
                email: userData.email,
                organization: { id: 327035, name: "Rijksuniversiteit Groningen (Groningen)" },
                locale: "en-US",
                metadata: { marketConsentValue: false }
            };
        }

        const step2Response = await axiosInstance.post(personalInfoUrl, personalInfoPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // --- CEK AUTO-PASS (Khusus Teacher sering Auto-Pass) ---
        if (step2Response.data.currentStep === 'success') {
            return { success: true, message: "🎉 AUTO-PASS! Verifikasi langsung disetujui tanpa upload dokumen.", data: step2Response.data };
        }

        // --- STEP 3: Cancel SSO ---
        await onProgress('3/7: Melewati login SSO...');
        const cancelSsoUrl = `https://services.sheerid.com/rest/v2/verification/${verificationId}/step/sso`;
        const ssoResponse = await axiosInstance.delete(cancelSsoUrl);

        // Cek lagi Auto-Pass setelah skip SSO
        if (ssoResponse.data.currentStep === 'success') {
            return { success: true, message: "🎉 AUTO-PASS! Verifikasi disetujui setelah skip SSO.", data: ssoResponse.data };
        }
        
        // --- STEP 4: Get Upload URL ---
        await onProgress('4/7: Meminta link upload...');
        const getUploadUrl = `https://services.sheerid.com/rest/v2/verification/${verificationId}/step/docUpload`;
        
        // Tentukan MIME dan Filename berdasarkan tipe
        const mimeType = type === 'teacher' ? 'image/png' : 'application/pdf';
        const fileName = type === 'teacher' ? 'teacher_badge.png' : 'document.pdf';

        const uploadUrlPayload = {
            files: [{ fileName: fileName, mimeType: mimeType, fileSize: fileBuffer.length }]
        };
        const uploadUrlResponse = await axiosInstance.post(getUploadUrl, uploadUrlPayload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const uploadUrl = uploadUrlResponse.data.documents[0]?.uploadUrl;
        if (!uploadUrl) throw new Error('Gagal mendapatkan URL untuk upload dokumen.');

        // --- STEP 5: Upload Document ---
        await onProgress('5/7: Mengunggah dokumen...');
        await axios.put(uploadUrl, fileBuffer, {
            headers: {
                'Content-Type': mimeType,
                'Content-Length': fileBuffer.length
            }
        });

        // --- STEP 6: Complete Upload ---
        await onProgress('6/7: Menyelesaikan proses upload...');
        const completeUploadUrl = `https://services.sheerid.com/rest/v2/verification/${verificationId}/step/completeDocUpload`;
        await axiosInstance.post(completeUploadUrl, {}, {
            headers: { 'Content-Length': '0', 'Content-Type': 'application/json' }
        });
        
        // --- STEP 7: Polling for Status ---
        await onProgress('7/7: Menunggu hasil verifikasi...');
        const statusUrl = `https://my.sheerid.com/rest/v2/verification/${verificationId}`;
        for (let i = 0; i < 15; i++) { 
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