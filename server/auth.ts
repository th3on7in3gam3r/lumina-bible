import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lumina_bible_secret_key_12345';

// Signup
router.post('/signup', async (req: Request, res: Response) => {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
            [email, passwordHash, displayName]
        );

        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({ user, token });
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

        // Update last login
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                streakCount: user.streak_count,
                joinedAt: user.joined_at
            },
            token
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
