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
    const client = await pool.connect();
    try {
        // Add Unique Constraints if they don't exist (using a DO block or simple try/catch)
        // 1. Notes Unique Constraint
        await client.query(`
            ALTER TABLE notes ADD CONSTRAINT notes_user_verse_unique UNIQUE (user_id, book, chapter, verse);
        `).catch(() => console.log('✓ Notes constraint already exists or handled.'));

        // 2. Bookmarks Unique Constraint
        await client.query(`
            ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_user_verse_unique UNIQUE (user_id, book, chapter, verse);
        `).catch(() => console.log('✓ Bookmarks constraint already exists or handled.'));

        console.log('✅ Startup migrations finished.');
    } catch (err) {
        console.error('⚠️ Startup migration warning:', err);
    } finally {
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
