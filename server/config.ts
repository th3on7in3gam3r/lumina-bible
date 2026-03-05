import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'lumina_bible_secret_key_12345';
export const PORT = process.env.PORT || 5001;
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Ultimate Database Configuration (v17)
// Individual parameters are more stable for SSL handshakes than a single connection string.
export const DB_CONFIG = {
    user: process.env.DB_USER || 'tsdbadmin',
    password: process.env.DB_PASSWORD || 'uhno13880e0wxwpx',
    host: process.env.DB_HOST || 'ymm3t71zrg.nfxkdhjqg4.tsdb.cloud.timescale.com',
    port: parseInt(process.env.DB_PORT || '34923'),
    database: process.env.DB_NAME || 'tsdb',
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    max: 10
};
