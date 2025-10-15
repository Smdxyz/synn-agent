// lib/og-downloader.js
// Berisi logika inti dari skrip 'wolep' yang sudah diadaptasi untuk bot.

// Kita butuh 'fetch' yang stabil. Jika versi Node-mu di bawah 18, ini mungkin butuh polyfill.
// Tapi karena Baileys modern butuh Node v18+, ini seharusnya aman.

export const yt = {
    url: Object.freeze({
        audio128: 'https://api.apiapi.lat',
        video: 'https://api5.apiapi.lat',
        else: 'https://api3.apiapi.lat',
        referrer: 'https://ogmp3.pro/'
    }),

    encUrl: (string) => string.split('').map(c => c.charCodeAt()).reverse().join(';'),
    xor: (string) => string.split('').map(s => String.fromCharCode(s.charCodeAt() ^ 1)).join(''),
    genRandomHex: () => {
        const hex = '0123456789abcdef'.split('');
        return Array.from({ length: 32 }, _ => hex[Math.floor(Math.random() * hex.length)]).join('');
    },

    init: async function (rpObj) {
        const { apiOrigin, payload } = rpObj;
        const { data } = payload;
        const api = `${apiOrigin}/${this.genRandomHex()}/init/${this.encUrl(this.xor(data))}/${this.genRandomHex()}/`;
        
        const resp = await fetch(api, {
            method: 'post',
            headers: { 'Content-Type': 'application/json' }, // Header minimalis lebih aman
            body: JSON.stringify(payload)
        });

        if (!resp.ok) throw new Error(`Server merespons dengan status ${resp.status}`);
        return resp.json();
    },

    genFileUrl: function (i, pk, rpObj) {
        const { apiOrigin } = rpObj;
        const pk_value = pk ? `${pk}/` : "";
        const downloadUrl = `${apiOrigin}/${this.genRandomHex()}/download/${i}/${this.genRandomHex()}/${pk_value}`;
        return { downloadUrl };
    },

    statusCheck: async function (i, pk, rpObj, onProgress) {
        const { apiOrigin } = rpObj;
        let json = {};
        let attempt = 0;
        const maxAttempts = 40;

        do {
            await new Promise(resolve => setTimeout(resolve, 4000)); // Jeda 4 detik
            attempt++;
            const pk_value = pk ? `${pk}/` : '';
            const api = `${apiOrigin}/${this.genRandomHex()}/status/${i}/${this.genRandomHex()}/${pk_value}`;
            
            const resp = await fetch(api, {
                method: 'post',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: i })
            });

            if (!resp.ok) { // Jika polling gagal, coba lagi beberapa kali
                if (attempt >= maxAttempts) throw new Error(`Pengecekan status gagal terus-menerus.`);
                continue;
            }
            
            json = await resp.json();
            
            // --- MODIFIKASI UNTUK BOT ---
            if (onProgress) onProgress("Memeriksa status...", attempt, maxAttempts);
            // -----------------------------

        } while (json.s === "P" && attempt < maxAttempts);

        if (json.s === "E") throw new Error('Konversi gagal di server.');
        if (json.s !== "C") throw new Error('Waktu pemrosesan habis atau status tidak diketahui.');
        
        return this.genFileUrl(i, pk, rpObj);
    },

    download: async function (ytUrl, userFormat = '128k', onProgress) {
        const rpObj = this.resolvePayload(ytUrl, userFormat);
        if (onProgress) onProgress("Memulai permintaan...", 0, 0);

        const initObj = await this.init(rpObj);
        const { i, pk, s, t: title } = initObj;

        if (!i) throw new Error("Gagal mendapatkan ID tugas dari server.");
        if (onProgress) onProgress(`Mendapat ID Tugas: ${i.substring(0, 8)}...`, 0, 0);

        let result = { userFormat, title };
        let finalData;

        if (s === 'C') {
            finalData = this.genFileUrl(i, pk, rpObj);
        } else {
            finalData = await this.statusCheck(i, pk, rpObj, onProgress);
        }
        Object.assign(result, finalData);
        return result;
    },

    resolvePayload: function (ytUrl, userFormat) {
        const validFormat = ['64k', '96k', '128k', '192k', '256k', '320k', '240p', '360p', '480p', '720p', '1080p'];
        if (!validFormat.includes(userFormat)) throw new Error(`Format tidak valid: ${userFormat}`);
        if (typeof (ytUrl) !== "string" || !ytUrl.trim().length) throw new Error('URL YouTube tidak boleh kosong.');

        let apiOrigin = this.url.audio128;
        let data = this.xor(ytUrl);
        let referer = this.url.referrer;
        let format = '0'; // 0=audio
        let mp3Quality = '128';
        let mp4Quality = '720';

        if (userFormat === '128k') {
            apiOrigin = this.url.audio128;
        } else if (/^\d+p$/.test(userFormat)) {
            apiOrigin = this.url.video;
            mp4Quality = userFormat.replace('p', '');
            format = '1'; // 1=video
        } else {
            apiOrigin = this.url.else;
            mp3Quality = userFormat.replace('k', '');
        }
        
        const payload = { data, format, referer, mp3Quality, mp4Quality, "userTimeZone": "-480" };
        return { apiOrigin, payload };
    }
};