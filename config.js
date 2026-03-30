import { configManager } from './libs/configManager.js';

// Menggunakan Proxy agar bisa selalu mengembalikan config terbaru dari memory.
export const config = new Proxy({}, {
    get: function(target, prop, receiver) {
        const currentConfig = configManager.get();
        if (prop in currentConfig) {
            return currentConfig[prop];
        }
        return undefined;
    },
    set: function(target, prop, value, receiver) {
        configManager.set(prop, value);
        return true;
    }
});
