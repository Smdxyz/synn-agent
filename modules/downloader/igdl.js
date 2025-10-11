// /modules/downloaders/igdl.js — (FINAL DENGAN DUA MODE: BUFFER & DIRECT LINK)

import axios from 'axios';
import { config } from '../../config.js';
import { sendMessage, sendVideo, sendImage, editMessage, delay, sendAlbum } from '../../helper.js';

// --- METADATA COMMAND ---
export const category = 'Downloaders';
export const description = 'Mengunduh media dari Instagram. Tambahkan "-link" untuk mode direct link.';
export const usage = `${config.BOT_PREFIX}igdl <url> atau ${config.BOT_PREFIX}igdl-link <url>`;
// Tambahkan alias untuk mode direct link
export const aliases = ['ig', 'instagram', 'instadl', 'igdl-link', 'iglink'];

// --- FUNGSI UTAMA ---
export default async function execute(sock, msg, args, text, sender) {
    const url = args[0];
    const fullText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    
    // ==========================================================
    // ===               ANDA YANG PEGANG KENDALI               ===
    // ==========================================================
    // Cek apakah pengguna meminta mode direct link
    const useDirectLinkMethod = /igdl-link|iglink/.test(fullText.split(' ')[0].slice(config.BOT_PREFIX.length));
    
    if (!url) {
        return sendMessage(sock, sender, `Silakan berikan link Instagram.\n\n*Mode Normal (Aman):*\n\`${config.BOT_PREFIX}igdl <url>\`\n\n*Mode Langsung (Eksperimental):*\n\`${config.BOT_PREFIX}igdl-link <url>\``, { quoted: msg });
    }
    if (!/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(p|reel|reels)\//.test(url)) {
        return sendMessage(sock, sender, `Link yang Anda berikan tidak valid.`, { quoted: msg });
    }

    const modeText = useDirectLinkMethod ? 'Direct Link' : 'Buffer';
    const initialMsg = await sock.sendMessage(sender, { text: `⏳ Memproses link... (Mode: ${modeText})` }, { quoted: msg });
    const editProgress = (txt) => editMessage(sock, sender, txt, initialMsg.key);

    try {
        const { data: apiResponse } = await axios.get('https://szyrineapi.biz.id/api/downloaders/ig', {
            params: { url },
            timeout: 60000
        });

        if (apiResponse.status !== 200 || !apiResponse.result) {
            throw new Error(apiResponse.message || 'Gagal mendapatkan data dari API.');
        }

        const result = apiResponse.result;
        const caption = result.caption || `Diunduh dengan ${config.BOT_NAME}`;
        const mediaItems = result.media;

        await editProgress(`✅ Data diterima! Total media: ${result.total_media}. Mengirim...`);
        
        const photos = [];
        const videos = [];
        mediaItems.forEach(media => (media.tipe === 'foto' ? photos.push(media) : videos.push(media)));

        if (photos.length > 0) {
            const albumPayload = photos.map((photo, index) => ({
                image: { url: photo.url },
                caption: (index === 0) ? caption : ''
            }));
            await sendAlbum(sock, sender, albumPayload, { quoted: msg });
        }

        if (videos.length > 0) {
            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                const videoCaption = videos.length > 1 ? `Video ${i + 1}/${videos.length}.\n\n${caption}` : caption;
                
                // ==========================================================
                // ===             LOGIKA PEMILIHAN MODE DI SINI            ===
                // ==========================================================
                if (useDirectLinkMethod) {
                    // MODE DIRECT LINK: Langsung serahkan URL ke Baileys. Terserah dia lah.
                    await editProgress(`🔗 Mengirim video ${i + 1}/${videos.length} via direct link...`);
                    await sendVideo(sock, sender, video.url, videoCaption, { quoted: msg });

                } else {
                    // MODE BUFFER (DEFAULT): Download dulu, validasi, baru kirim.
                    try {
                        await editProgress(`📥 Mengunduh stream video ${i + 1}/${videos.length}...`);
                        const { data: videoBuffer } = await axios.get(video.url, {
                            responseType: 'arraybuffer',
                            timeout: 180000,
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36' }
                        });

                        const MINIMUM_VIDEO_SIZE_BYTES = 100 * 1024; // 100 KB
                        if (videoBuffer.length < MINIMUM_VIDEO_SIZE_BYTES) {
                            throw new Error(`Stream berhenti prematur. File rusak.`);
                        }
                        
                        await sendVideo(sock, sender, videoBuffer, videoCaption, { quoted: msg });

                    } catch (downloadError) {
                        await sendMessage(sock, sender, `❌ Gagal mengunduh video ${i + 1}: ${downloadError.message}`, { quoted: msg });
                    }
                }
                await delay(1000);
            }
        }
        
        await editProgress('✅ Semua media berhasil diproses dan dikirim!');

    } catch (error) {
        console.error("[IGDL_ERROR]", error);
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        await editProgress(`❌ Terjadi kesalahan: ${errorMessage}`);
    }
}