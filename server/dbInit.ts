import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { DB_CONFIG } from './config.js';

const { Pool } = pg;
const pool = new Pool(DB_CONFIG);

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('--- Initializing Tiger Cloud Database ---');

    // Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        streak_count INTEGER DEFAULT 0,
        last_login TIMESTAMP
      );
    `);
    console.log('✓ Users table ready');

    // Notes Table
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
    console.log('✓ Notes table ready');

    // Bookmarks Table
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
    console.log('✓ Bookmarks table ready');

    // Reading Progress Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        active_plan_id TEXT,
        completed_chapters JSONB DEFAULT '{}',
        last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Reading Progress table ready');

    // Highlights Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS highlights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        verse_key TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Highlights table ready');

    console.log('--- Database Initialization Complete ---');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

initializeDatabase();
