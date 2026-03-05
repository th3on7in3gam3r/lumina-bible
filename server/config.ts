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

// Hardened Database Configuration for Timescale/Tiger Cloud
const baseUri = process.env.DB_URL || `postgres://${process.env.DB_USER || 'tsdbadmin'}:${process.env.DB_PASSWORD || 'uhno13880e0wxwpx'}@${process.env.DB_HOST || 'ymm3t71zrg.nfxkdhjqg4.tsdb.cloud.timescale.com'}:${process.env.DB_PORT || '34923'}/${process.env.DB_NAME || 'tsdb'}`;

// Ensure sslmode=require is present in the connection string
const connectionString = baseUri.includes('sslmode=') ? baseUri : `${baseUri}${baseUri.includes('?') ? '&' : '?'}sslmode=require`;

export const DB_CONFIG = {
    connectionString,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 15000,
    keepalives: true,
    max: 10
};
