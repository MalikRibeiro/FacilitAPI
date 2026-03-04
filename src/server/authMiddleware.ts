import { createClient } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';
import { pool } from './db.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(503).json({ 
      error: 'Servidor não configurado. Por favor, configure as variáveis de ambiente do Supabase.' 
    });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  // Ensure user exists in our 'users' table (Upsert on first access)
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
    if (userResult.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (id, email, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [user.id, user.email, user.user_metadata?.name || user.email?.split('@')[0]]
      );
    }
  } catch (dbError) {
    console.error('Error syncing user to database:', dbError);
    // Continue anyway as the auth is valid
  }

  req.user = user;
  next();
}
