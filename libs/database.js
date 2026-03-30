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

// Helper untuk baca/tulis file (dengan perbaikan)
const readFile = (filePath) => {
    if (!fs.existsSync(filePath)) {
        return {};
    }
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        // [PERBAIKAN] Cek apakah file kosong atau hanya berisi spasi
        if (!fileContent.trim()) {
            return {}; // Return objek kosong jika file tidak ada isinya
        }
        // [AMAN] Hanya parse jika ada konten
        return JSON.parse(fileContent);
    } catch (e) {
        console.error(`[Database] Gagal membaca atau parse file JSON: ${filePath}`, e);
        return {}; // Kembalikan objek kosong jika terjadi error parse
    }
};

const writeFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const normalizeUserId = (userId) => {
    if (!userId) return userId;
    const [local, domain] = userId.split('@');
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
    getUser: (userId) => {
        const normalizedId = normalizeUserId(userId);
        const users = readFile(userFilePath);
        if (!users[normalizedId]) {
            users[normalizedId] = buildUserDefaults();
            writeFile(userFilePath, users);
        }
        const migratedUser = applyUserMigration(users[normalizedId]);
        if (JSON.stringify(migratedUser) !== JSON.stringify(users[normalizedId])) {
            users[normalizedId] = migratedUser;
            writeFile(userFilePath, users);
        }
        return migratedUser;
    },
    updateUser: (userId, data) => {
        const normalizedId = normalizeUserId(userId);
        const users = readFile(userFilePath);
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

        users[normalizedId] = applyUserMigration({ ...db.getUser(normalizedId), ...updates });
        writeFile(userFilePath, users);
        return users[normalizedId];
    },

    // Tambahan method aman untuk koin
    addCoins: (userId, amount) => {
        if (amount <= 0 || isNaN(amount)) return null;
        const user = db.getUser(userId);
        return db.updateUser(userId, { coins: (user.coins || 0) + amount });
    },

    reduceCoins: (userId, amount) => {
        if (amount <= 0 || isNaN(amount)) return false;
        const user = db.getUser(userId);
        const currentCoins = user.coins || 0;
        if (currentCoins < amount) return false;
        db.updateUser(userId, { coins: currentCoins - amount });
        return true;
    },

    // Tambahan method aman untuk VIP
    addVipDays: (userId, days) => {
        if (days <= 0 || isNaN(days)) return null;
        const user = db.getUser(userId);
        let newExpiry;

        // Jika sudah VIP, perpanjang dari tanggal expired sebelumnya
        if (user.vipUntil && moment().isBefore(moment(user.vipUntil))) {
            newExpiry = moment(user.vipUntil).add(days, 'days');
        } else {
            // Jika belum VIP / sudah expired, mulai dari sekarang
            newExpiry = moment().add(days, 'days');
        }

        return db.updateUser(userId, { vipUntil: newExpiry.toISOString() });
    },

    removeVip: (userId) => {
        return db.updateUser(userId, { vipUntil: null });
    },
    getAllUsers: () => readFile(userFilePath),
    
    // Code Database
    getCode: (code) => {
        const codes = readFile(codeFilePath);
        return codes[code.toUpperCase()];
    },
    addCode: (codeData) => {
        const codes = readFile(codeFilePath);
        codes[codeData.code.toUpperCase()] = codeData;
        writeFile(codeFilePath, codes);
    },
    updateCode: (code, data) => {
        const codes = readFile(codeFilePath);
        const upperCode = code.toUpperCase();
        if(codes[upperCode]) {
            codes[upperCode] = { ...codes[upperCode], ...data };
            writeFile(codeFilePath, codes);
            return codes[upperCode];
        }
        return null;
    },

    // Utility Cek VIP
    isVip: (userId) => {
        const user = db.getUser(userId);
        if (!user.vipUntil) return false;
        return moment().isBefore(moment(user.vipUntil));
    }
};

export default db;
