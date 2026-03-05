import { Router } from 'express';
import pool from './db.js';
import { authenticateToken } from './middleware.js';
const router = Router();
// Fetch all user data
router.get('/data', authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    try {
        const [notes, bookmarks, progress, highlights] = await Promise.all([
            pool.query('SELECT * FROM notes WHERE user_id = $1', [userId]),
            pool.query('SELECT * FROM bookmarks WHERE user_id = $1', [userId]),
            pool.query('SELECT * FROM reading_progress WHERE user_id = $1', [userId]),
            pool.query('SELECT * FROM highlights WHERE user_id = $1', [userId])
        ]);
        res.json({
            notes: notes.rows,
            bookmarks: bookmarks.rows,
            progress: progress.rows[0] || null,
            highlights: highlights.rows
        });
    }
    catch (err) {
        console.error('Fetch data error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Sync data (Batch update)
router.post('/sync', authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    const { notes, bookmarks, progress } = req.body;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        // 1. Sync Notes (Upsert based on verse)
        if (notes && Array.isArray(notes)) {
            for (const note of notes) {
                await client.query(`INSERT INTO notes (user_id, book, chapter, verse, content, updated_at) 
                     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                     ON CONFLICT (user_id, book, chapter, verse) 
                     DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP`, [userId, note.book, note.chapter, note.verse, note.content]);
            }
        }
        // 2. Sync Bookmarks (Ignore if exists)
        if (bookmarks && Array.isArray(bookmarks)) {
            for (const bm of bookmarks) {
                await client.query(`INSERT INTO bookmarks (user_id, book, chapter, verse, reference) 
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (user_id, book, chapter, verse) DO NOTHING`, [userId, bm.book, bm.chapter, bm.verse, bm.reference]);
            }
        }
        // 3. Sync Progress (Upsert based on user_id)
        if (progress) {
            await client.query(`INSERT INTO reading_progress (user_id, active_plan_id, completed_chapters, last_read_at) 
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id) DO UPDATE SET 
                    active_plan_id = EXCLUDED.active_plan_id, 
                    completed_chapters = EXCLUDED.completed_chapters,
                    last_read_at = CURRENT_TIMESTAMP`, [userId, progress.activePlanId, JSON.stringify(progress.completedChapters || {})]);
        }
        await client.query('COMMIT');
        res.json({ success: true, timestamp: new Date().toISOString() });
    }
    catch (err) {
        if (client)
            await client.query('ROLLBACK');
        console.error('CRITICAL SYNC ERROR:', err);
        res.status(500).json({
            error: 'Database synchronization failed',
            details: err.message,
            code: err.code
        });
    }
    finally {
        if (client)
            client.release();
    }
});
export default router;
