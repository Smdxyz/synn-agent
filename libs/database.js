// libs/database.js
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import { config } from '../config.js';
import paths from './paths.js';

const dbPath = paths.database;
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
}

const userFilePath = path.join(dbPath, 'users.json');
const codeFilePath = path.join(dbPath, 'codes.json');

// Kunci antrean asinkron untuk mencegah data race
let writeQueue = Promise.resolve();

// Helper untuk baca/tulis file asinkron
const readFile = async (filePath) => {
    if (!fs.existsSync(filePath)) {
        return {};
    }
    try {
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        if (!fileContent.trim()) {
            return {};
        }
        return JSON.parse(fileContent);
    } catch (e) {
        console.error(`[Database] Gagal membaca atau parse file JSON: ${filePath}`, e);
        return {};
    }
};

// Fungsi untuk membungkus operasi baca-tulis penuh dalam satu antrean/kunci (mutex)
const withLock = async (action) => {
    // Tunggu antrean sebelumnya selesai, tapi jangan lemparkan error dari antrean sebelumnya
    const nextQueue = writeQueue.then(async () => {
        return await action();
    }).catch(async (err) => {
        console.error("[Database] Error dalam antrean database:", err);
        return await action(); // Coba lagi jika terjadi error aneh di chain sebelumnya
    });
    writeQueue = nextQueue.catch(() => {}); // Catch global untuk mencegah UnhandledPromiseRejection di chain
    return nextQueue;
};

const writeFileRaw = async (filePath, data) => {
    try {
        const tmpFile = filePath + '.tmp';
        await fs.promises.writeFile(tmpFile, JSON.stringify(data, null, 2));
        await fs.promises.rename(tmpFile, filePath);
    } catch (e) {
        console.error(`[Database] Gagal menulis file JSON: ${filePath}`, e);
    }
};

const normalizeUserId = (userId) => {
    if (typeof userId !== 'string') return userId;
    const parts = userId.split('@');
    const local = parts.shift();
    const domain = parts.join('@');
    const normalizedLocal = local.split(':')[0];
    return domain ? `${normalizedLocal}@${domain}` : normalizedLocal;
};

const buildUserDefaults = () => ({
    coins: config.coins.defaultCoins ?? 0,
    vipUntil: null,
    lastCheckin: null
});

const applyUserMigration = (user) => {
    const defaults = buildUserDefaults();
    const migrated = {
        ...defaults,
        ...user,
    };

    // Migrate old points/coin to new coins property
    if (migrated.coins == null) {
        if (migrated.points != null) {
            migrated.coins = migrated.points;
        } else if (migrated.coin != null) {
            migrated.coins = migrated.coin;
        }
    }

    delete migrated.points;
    delete migrated.coin;
    delete migrated.referral;

    return migrated;
};

// User Database
export const db = {
    normalizeUserId,
    getUser: async (userId) => {
        return await withLock(async () => {
            const normalizedId = normalizeUserId(userId);
            const users = await readFile(userFilePath);
            let updated = false;
            if (!users[normalizedId]) {
                users[normalizedId] = buildUserDefaults();
                updated = true;
            }
            const migratedUser = applyUserMigration(users[normalizedId]);
            if (JSON.stringify(migratedUser) !== JSON.stringify(users[normalizedId])) {
                users[normalizedId] = migratedUser;
                updated = true;
            }
            if (updated) await writeFileRaw(userFilePath, users);
            return migratedUser;
        });
    },
    updateUser: async (userId, data) => {
        return await withLock(async () => {
            const normalizedId = normalizeUserId(userId);
            const users = await readFile(userFilePath);
            const updates = { ...data };

            // Prevent negative coins
            if (updates.coins != null && updates.coins < 0) {
                updates.coins = 0;
            }

            // Migrate inputs just in case
            if (updates.coins == null) {
                if (updates.points != null) {
                    updates.coins = updates.points;
                } else if (updates.coin != null) {
                    updates.coins = updates.coin;
                }
            }
            delete updates.points;
            delete updates.coin;

            const currentUser = users[normalizedId] || buildUserDefaults();
            users[normalizedId] = applyUserMigration({ ...currentUser, ...updates });
            await writeFileRaw(userFilePath, users);
            return users[normalizedId];
        });
    },

    // Tambahan method aman untuk koin
    addCoins: async (userId, amount) => {
        if (amount <= 0 || isNaN(amount)) return null;
        const user = await db.getUser(userId);
        return await db.updateUser(userId, { coins: (user.coins || 0) + amount });
    },

    reduceCoins: async (userId, amount) => {
        if (amount <= 0 || isNaN(amount)) return false;
        const user = await db.getUser(userId);
        const currentCoins = user.coins || 0;
        if (currentCoins < amount) return false;
        await db.updateUser(userId, { coins: currentCoins - amount });
        return true;
    },

    // Tambahan method aman untuk VIP
    addVipDays: async (userId, days) => {
        if (days <= 0 || isNaN(days)) return null;
        const user = await db.getUser(userId);
        let newExpiry;

        // Jika sudah VIP, perpanjang dari tanggal expired sebelumnya
        if (user.vipUntil && moment().isBefore(moment(user.vipUntil))) {
            newExpiry = moment(user.vipUntil).add(days, 'days');
        } else {
            // Jika belum VIP / sudah expired, mulai dari sekarang
            newExpiry = moment().add(days, 'days');
        }

        return await db.updateUser(userId, { vipUntil: newExpiry.toISOString() });
    },

    removeVip: async (userId) => {
        return await db.updateUser(userId, { vipUntil: null });
    },
    getAllUsers: async () => await readFile(userFilePath),
    
    // Code Database
    getCode: async (code) => {
        const codes = await readFile(codeFilePath);
        return codes[code.toUpperCase()];
    },
    addCode: async (codeData) => {
        const codes = await readFile(codeFilePath);
        codes[codeData.code.toUpperCase()] = codeData;
        await writeFile(codeFilePath, codes);
    },
    updateCode: async (code, data) => {
        const codes = await readFile(codeFilePath);
        const upperCode = code.toUpperCase();
        if(codes[upperCode]) {
            codes[upperCode] = { ...codes[upperCode], ...data };
            await writeFile(codeFilePath, codes);
            return codes[upperCode];
        }
        return null;
    },

    // Utility Cek VIP
    isVip: async (userId) => {
        const user = await db.getUser(userId);
        if (!user.vipUntil) return false;
        return moment().isBefore(moment(user.vipUntil));
    }
};

export default db;
