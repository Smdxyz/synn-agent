// libs/database.js
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';

const dbPath = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath);
}

const userFilePath = path.join(dbPath, 'users.json');
const codeFilePath = path.join(dbPath, 'codes.json');

// Helper untuk baca/tulis file
const readFile = (filePath) => {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const writeFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// User Database
export const db = {
    getUser: (userId) => {
        const users = readFile(userFilePath);
        if (!users[userId]) {
            users[userId] = {
                points: 0,
                vipUntil: null,
                lastCheckin: null,
                referral: {
                    by: null,
                    count: 0
                }
            };
            writeFile(userFilePath, users);
        }
        return users[userId];
    },
    updateUser: (userId, data) => {
        const users = readFile(userFilePath);
        users[userId] = { ...db.getUser(userId), ...data };
        writeFile(userFilePath, users);
        return users[userId];
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