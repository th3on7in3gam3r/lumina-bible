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
// ROOT CAUSE FIX (v20):
// When using a connectionString, pg driver uses the URL's own ?sslmode=... parameter,
// which OVERRIDES any ssl:{} object we pass. If the URL has sslmode=disable the DB drops us.
// Solution: ALWAYS use individual parameters, parsing them from DB_URL if present.
function buildDbConfig() {
    // If DB_URL is set, parse it into individual parameters
    if (process.env.DB_URL) {
        try {
            const url = new URL(process.env.DB_URL);
            return {
                user: url.username || process.env.DB_USER || 'tsdbadmin',
                password: url.password || process.env.DB_PASSWORD || 'uhno13880e0wxwpx',
                host: url.hostname || process.env.DB_HOST || 'localhost',
                port: parseInt(url.port || process.env.DB_PORT || '5432'),
                database: url.pathname.replace('/', '') || process.env.DB_NAME || 'tsdb',
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 15000,
                idleTimeoutMillis: 30000,
                max: 10
            };
        }
        catch (e) {
            console.error('⚠️ Failed to parse DB_URL, falling back to individual params:', e);
        }
    }
    // Fallback: use individual env vars directly
    return {
        user: process.env.DB_USER || 'tsdbadmin',
        password: process.env.DB_PASSWORD || 'uhno13880e0wxwpx',
        host: process.env.DB_HOST || 'ymm3t71zrg.nfxkdhjqg4.tsdb.cloud.timescale.com',
        port: parseInt(process.env.DB_PORT || '34923'),
        database: process.env.DB_NAME || 'tsdb',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 30000,
        max: 10
    };
}
export const DB_CONFIG = buildDbConfig();
