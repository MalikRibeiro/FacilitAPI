import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "facilitapi.db");
export const db = new Database(dbPath);

export function initDb() {
  // Check if we need to migrate the table
  const tableInfo = db.pragma("table_info(integrations)") as any[];
  const hasCustomUrl = tableInfo.some(col => col.name === 'custom_url');
  
  if (!hasCustomUrl && tableInfo.length > 0) {
    db.exec(`
      DROP TABLE execution_logs;
      DROP TABLE integrations;
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      custom_url TEXT NOT NULL,
      http_method TEXT NOT NULL,
      encrypted_headers TEXT NOT NULL,
      data_mapping TEXT NOT NULL,
      output_type TEXT NOT NULL,
      destination_db_string TEXT,
      target_table TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS execution_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      records_processed INTEGER DEFAULT 0,
      error_message TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (integration_id) REFERENCES integrations(id)
    );
  `);
}
