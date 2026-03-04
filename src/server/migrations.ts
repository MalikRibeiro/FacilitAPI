import { pool } from './db.js';

export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Skipping migrations.');
    return;
  }
  
  console.log('Running migrations...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Tabela de usuários (espelho do Supabase Auth)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        plan TEXT DEFAULT 'free',
        integrations_limit INTEGER DEFAULT 3,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Tabela de integrações
    await client.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        custom_url TEXT NOT NULL,
        http_method TEXT NOT NULL DEFAULT 'GET',
        encrypted_headers TEXT NOT NULL,
        data_mapping TEXT NOT NULL DEFAULT '[]',
        output_type TEXT NOT NULL DEFAULT 'csv',
        destination_db_string TEXT,
        target_table TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Tabela de logs de execução
    await client.query(`
      CREATE TABLE IF NOT EXISTS execution_logs (
        id SERIAL PRIMARY KEY,
        integration_id INTEGER NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        records_processed INTEGER DEFAULT 0,
        error_message TEXT,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('Migrations completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migrations if this script is executed directly
if (process.argv[1] === import.meta.filename) {
  runMigrations().catch(() => process.exit(1));
}
