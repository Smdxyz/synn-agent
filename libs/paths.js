import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const paths = {
    root: ROOT_DIR,
    database: path.join(ROOT_DIR, 'database'),
    assets: path.join(ROOT_DIR, 'assets'),
    modules: path.join(ROOT_DIR, 'modules'),
    libs: path.join(ROOT_DIR, 'libs'),
    auth: path.join(ROOT_DIR, 'auth_info_baileys'),
    helper: path.join(ROOT_DIR, 'helper.js'),
    config: path.join(ROOT_DIR, 'config.js'),
    settings: path.join(ROOT_DIR, 'settings.js')
};

export default paths;
