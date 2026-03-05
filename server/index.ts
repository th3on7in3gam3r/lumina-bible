import express from 'express';
import cors from 'cors';

// CRITICAL: Force allow self-signed certificates BEFORE any database connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { PORT, NODE_ENV } from './config.js';

// Routes
import authRoutes from './auth.js';
import dataRoutes from './data.js';

const app = express();

// Middleware
app.use(cors()); // Allow all origins during production push for maximum compatibility
app.use(express.json());

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

        // 2. Clean and Prepare Notes
        console.log('  - Syncing Notes schema...');
        await client.query(`
            DELETE FROM notes a USING notes b 
            WHERE a.id < b.id 
            AND a.user_id = b.user_id AND a.book = b.book AND a.chapter = b.chapter AND a.verse = b.verse;
        `);
        await client.query(`
            ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_user_verse_unique;
            ALTER TABLE notes ADD CONSTRAINT notes_user_verse_unique UNIQUE (user_id, book, chapter, verse);
        `).catch(e => console.log('    Note: constraint exists or handled'));

        // 3. Clean and Prepare Bookmarks
        console.log('  - Syncing Bookmarks schema...');
        await client.query(`
            DELETE FROM bookmarks a USING bookmarks b 
            WHERE a.id < b.id 
            AND a.user_id = b.user_id AND a.book = b.book AND a.chapter = b.chapter AND a.verse = b.verse;
        `);
        await client.query(`
            ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_verse_unique;
            ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_user_verse_unique UNIQUE (user_id, book, chapter, verse);
        `).catch(e => console.log('    Note: constraint exists or handled'));

        console.log('✅ Startup migrations finished.');
    } catch (err: any) {
        console.error(`⚠️ Startup migration attempt failed:`, err.message);
        if (retries > 0) {
            console.log(`🔄 Retrying in 5 seconds...`);
            await new Promise(res => setTimeout(res, 5000));
            return runStartupMigration(retries - 1);
        }
    } finally {
        if (client) client.release();
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
    } catch (err: any) {
        let publicIp = 'unknown';
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            publicIp = ipData.ip;
        } catch (ipErr) { /* ignore */ }

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
    } catch (err) {
        console.error('❌ Failed to complete startup migration:', err);
    }
    console.log(`
🚀 Lumina Bible Server Running!
📡 Port: ${PORT}
🔗 Mode: ${NODE_ENV}
    `);
});
