import express from 'express';
// CRITICAL: Force allow self-signed certificates BEFORE any database connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { PORT, NODE_ENV } from './config.js';
// Routes
import authRoutes from './auth.js';
import dataRoutes from './data.js';
import geminiRoutes from './gemini.js';
const app = express();
// CORS: Must be placed before any routes and uses explicit headers
// so that even 500 error responses carry the Access-Control-Allow-Origin header
const ALLOWED_ORIGINS = [
    'https://biblefunland.com',
    'https://www.biblefunland.com',
    'https://lumina.biblefunland.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:5001'
];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Always allow locally for debugging, otherwise check allowlist
    if (!origin || origin.startsWith('http://localhost') || ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS')
        return res.sendStatus(200);
    next();
});
// Middleware — 50mb limit to handle large base64 gallery image payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
import pool from './db.js';
// Startup Migration with Retry
const runStartupMigration = async (retries = 5) => {
    console.log(`📦 Running startup migrations (Attempt ${6 - retries}/5)...`);
    let client;
    try {
        client = await pool.connect();
        // 1. Ensure Tables Exist
        console.log('  - Checking base tables...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                streak_count INTEGER DEFAULT 0
            );
        `);
        // Ensure last_login column exists (if table was created before we added it)
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
                    ALTER TABLE users ADD COLUMN last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `);
        // 2. Create missing tables
        console.log('  - Ensuring all tables exist...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                book TEXT NOT NULL,
                chapter INTEGER NOT NULL,
                verse INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, book, chapter, verse)
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS bookmarks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                book TEXT NOT NULL,
                chapter INTEGER NOT NULL,
                verse INTEGER NOT NULL,
                reference TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, book, chapter, verse)
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS reading_progress (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                active_plan_id TEXT,
                completed_chapters JSONB DEFAULT '{}',
                last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS highlights (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                verse_key TEXT NOT NULL,
                color TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, verse_key)
            );
        `);
        // Ensure highlights unique constraint exists (retroactive)
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'highlights_user_verse_unique'
                ) THEN
                    ALTER TABLE highlights ADD CONSTRAINT highlights_user_verse_unique UNIQUE (user_id, verse_key);
                END IF;
            END $$;
        `).catch(() => { }); // Ignore if already exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS gallery (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                local_id TEXT NOT NULL,
                url TEXT NOT NULL,
                reference TEXT NOT NULL,
                text TEXT NOT NULL,
                date TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, local_id)
            );
        `);
        console.log('✅ All tables ready.');
    }
    catch (err) {
        console.error(`⚠️ Startup migration attempt failed:`, err.message);
        if (retries > 0) {
            console.log(`🔄 Retrying in 5 seconds...`);
            await new Promise(res => setTimeout(res, 5000));
            return runStartupMigration(retries - 1);
        }
    }
    finally {
        if (client)
            client.release();
    }
};
// Global Error Handlers (Prevent 502/Crash)
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', dataRoutes);
app.use('/api/ai', geminiRoutes);
// Diagnostic Route: Test DB Connection with deep info
app.get('/api/test-db', async (req, res) => {
    const diagnostics = {
        env: {
            HAS_DB_URL: !!process.env.DB_URL,
            HAS_DB_HOST: !!process.env.DB_HOST,
            DB_HOST_PREVIEW: process.env.DB_HOST ? `${process.env.DB_HOST.substring(0, 5)}...` : 'none',
            NODE_ENV: process.env.NODE_ENV
        },
        config: {
            host: DB_CONFIG.host || 'via-connection-string',
            port: DB_CONFIG.port
        },
        timestamp: new Date().toISOString()
    };
    try {
        const result = await pool.query('SELECT current_database(), now(), version()');
        res.json({
            success: true,
            db: result.rows[0],
            diagnostics
        });
    }
    catch (err) {
        let publicIp = 'unknown';
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            publicIp = ipData.ip;
        }
        catch (ipErr) { /* ignore */ }
        res.status(500).json({
            error: 'DB Connection Failed',
            details: err.message,
            code: err.code,
            serverIp: publicIp,
            diagnostics
        });
    }
});
// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
import { DB_CONFIG } from './config.js';
app.listen(PORT, async () => {
    console.log(`📡 Server starting on port ${PORT}...`);
    console.log(`🗄️ Database Host: ${DB_CONFIG.host}`);
    try {
        await runStartupMigration();
    }
    catch (err) {
        console.error('❌ Failed to complete startup migration:', err);
    }
    console.log(`
🚀 Lumina Bible Server Running!
📡 Port: ${PORT}
🔗 Mode: ${NODE_ENV}
    `);
});
