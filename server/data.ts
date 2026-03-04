import { Router, Response } from 'express';
import pool from './db.js';
import { authenticateToken, AuthRequest } from './middleware.js';

const router = Router();

// Fetch all user data
router.get('/data', authenticateToken, async (req: AuthRequest, res: Response) => {
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
    } catch (err) {
        console.error('Fetch data error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sync data (Batch update)
router.post('/sync', authenticateToken, async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { notes, bookmarks, progress, highlights } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Note: In a production app, we'd do incremental sync. 
        // For simplicity here, we'll implement batch UPSERTs or specific logic for each type.

        // 1. Sync Notes
        if (notes) {
            for (const note of notes) {
                await client.query(
                    `INSERT INTO notes (user_id, book, chapter, verse, content, updated_at) 
                     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                     ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP`,
                    [userId, note.book, note.chapter, note.verse, note.content]
                );
            }
        }

        // 2. Sync Bookmarks
        if (bookmarks) {
            for (const bm of bookmarks) {
                await client.query(
                    `INSERT INTO bookmarks (user_id, book, chapter, verse, reference) 
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (id) DO NOTHING`,
                    [userId, bm.book, bm.chapter, bm.verse, bm.reference]
                );
            }
        }

        // 3. Sync Progress
        if (progress) {
            await client.query(
                `INSERT INTO reading_progress (user_id, active_plan_id, completed_chapters, last_read_at) 
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id) DO UPDATE SET 
                    active_plan_id = EXCLUDED.active_plan_id, 
                    completed_chapters = EXCLUDED.completed_chapters,
                    last_read_at = CURRENT_TIMESTAMP`,
                [userId, progress.activePlanId, JSON.stringify(progress.completedChapters)]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Sync error:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

export default router;
