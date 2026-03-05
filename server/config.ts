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

// Force allow self-signed certificates
if (NODE_ENV === 'production' || process.env.DB_URL) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export const DB_CONFIG = process.env.DB_URL
    ? {
        connectionString: process.env.DB_URL,
        ssl: { rejectUnauthorized: false }
    }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '34923'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false }
    };
