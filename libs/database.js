// libs/database.js
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import { config } from '../config.js';

const dbPath = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath);
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
    points: config.points.defaultPoints ?? 0,
    vipUntil: null,
    lastCheckin: null
});

const applyUserMigration = (user) => {
    const defaults = buildUserDefaults();
    const migrated = {
        ...defaults,
        ...user,
    };

    if (migrated.points == null && migrated.coin != null) {
        migrated.points = migrated.coin;
    }

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
        if (updates.points == null && updates.coin != null) {
            updates.points = updates.coin;
        }
        delete updates.coin;
        users[normalizedId] = applyUserMigration({ ...db.getUser(normalizedId), ...updates });
        writeFile(userFilePath, users);
        return users[normalizedId];
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
