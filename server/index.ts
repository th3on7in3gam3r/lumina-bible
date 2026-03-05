import express from 'express';
import cors from 'cors';
import { PORT, NODE_ENV } from './config.js';

// Routes
import authRoutes from './auth.js';
import dataRoutes from './data.js';

const app = express();

// Middleware
app.use(cors()); // Allow all origins during production push for maximum compatibility
app.use(express.json());

import pool from './db.js';

// Startup Migration: Ensure schema is ready for sync
const runStartupMigration = async () => {
    console.log('📦 Running startup migrations...');
    let client;
    try {
        client = await pool.connect();

        // 1. Clean and Prepare Notes
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

        // 2. Clean and Prepare Bookmarks
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
    } catch (err) {
        console.error('⚠️ Startup migration warning:', err);
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

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
    await runStartupMigration();
    console.log(`
🚀 Lumina Bible Server Running!
📡 Port: ${PORT}
🔗 Mode: ${NODE_ENV}
    `);
});
