import { pool } from "./db.js";
import { decrypt } from "./crypto.js";
import pg from "pg";
const { Client } = pg;
import fs from "fs";
import path from "path";

// Simulated Worker for ETL
export async function runETLTask(integrationId: number) {
  console.log(`[Worker] Starting ETL task for integration ${integrationId}`);
  
  try {
    // 1. Fetch integration details
    const result = await pool.query("SELECT * FROM integrations WHERE id = $1", [integrationId]);
    const integration = result.rows[0];
    
    if (!integration) {
      throw new Error("Integration not found");
    }

    const { custom_url, http_method, encrypted_headers, data_mapping, output_type, destination_db_string, target_table } = integration;
    
    const headersConfig = JSON.parse(decrypt(encrypted_headers));
    const dataMappingConfig = JSON.parse(data_mapping);
    
    const headers: Record<string, string> = {};
    headersConfig.forEach((h: any) => {
      if (h.key && h.value) headers[h.key] = h.value;
    });

    console.log(`[Worker] Fetching data from ${custom_url} via ${http_method}...`);
    
    const response = await fetch(custom_url, {
      method: http_method,
      headers,
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    let rawData = await response.json();
    let data = rawData;
    
    // Auto-detect common wrapper if data is not an array
    if (!Array.isArray(data) && data && typeof data === 'object') {
      if (Array.isArray(data.data)) {
        data = data.data;
      } else if (Array.isArray(data.items)) {
        data = data.items;
      } else if (Array.isArray(data.results)) {
        data = data.results;
      }
    }

    // Ensure data is an array for processing
    if (!Array.isArray(data)) {
      data = [data];
    }

    let recordsProcessed = 0;
    let logMessage = "";

    if (output_type === 'database') {
      if (!destination_db_string || !target_table) throw new Error("Database connection string and target table are required.");
      
      console.log(`[Worker] Conectando ao banco de destino para inserir ${data.length} registros...`);
      
      if (data.length > 0) {
        const client = new Client({ 
          connectionString: destination_db_string,
          ssl: { rejectUnauthorized: false }
        });
        await client.connect();
        
        try {
          // Build dynamic insert
          const columns = dataMappingConfig.map((m: any) => m.dbColumn);
          const jsonPaths = dataMappingConfig.map((m: any) => m.jsonPath);
          
          if (columns.length === 0) throw new Error("No data mapping configured.");

          const placeholders = columns.map((_: any, i: number) => `$${i + 1}`).join(", ");
          const query = `INSERT INTO ${target_table} (${columns.join(", ")}) VALUES (${placeholders})`;

          for (const item of data) {
            const values = jsonPaths.map((path: string) => {
              // Simple path resolution (e.g., "owner.login" or just "id")
              return path.split('.').reduce((obj: any, key: string) => obj && obj[key] !== undefined ? obj[key] : null, item);
            });
            await client.query(query, values);
          }
        } finally {
          await client.end();
        }
        
        recordsProcessed = data.length;
        logMessage = `Sucesso! ${data.length} registros inseridos na tabela ${target_table}.`;
      } else {
        recordsProcessed = 0;
        logMessage = `Sucesso! Nenhum dado retornado pela API.`;
      }
    } else if (output_type === 'csv') {
      if (data.length > 0) {
        // Map data if mapping exists, otherwise use raw
        const mappedData = data.map((item: any) => {
          if (dataMappingConfig.length > 0) {
            const row: any = {};
            dataMappingConfig.forEach((m: any) => {
              row[m.dbColumn] = m.jsonPath.split('.').reduce((obj: any, key: string) => obj && obj[key] !== undefined ? obj[key] : null, item);
            });
            return row;
          }
          return item;
        });

        const keys = Object.keys(mappedData[0]);
        const header = keys.join(",");
        const rows = mappedData.map((item: any) => keys.map(k => JSON.stringify(item[k] ?? "")).join(","));
        const csvContent = [header, ...rows].join("\n");

        const downloadsDir = path.resolve(process.cwd(), "public", "downloads");
        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir, { recursive: true });
        }
        
        const fileName = `export_${integrationId}_${Date.now()}.csv`;
        const filePath = path.join(downloadsDir, fileName);
        fs.writeFileSync(filePath, csvContent);

        recordsProcessed = data.length;
        logMessage = `Sucesso! CSV gerado com ${data.length} linhas. Arquivo: /downloads/${fileName}`;
      } else {
        recordsProcessed = 0;
        logMessage = `Sucesso! Nenhum dado retornado pela API para gerar CSV.`;
      }
    }

    // 4. Log success
    await pool.query(`
      INSERT INTO execution_logs (integration_id, status, records_processed, error_message)
      VALUES ($1, $2, $3, $4)
    `, [integrationId, "success", recordsProcessed, logMessage]);

    console.log(`[Worker] ETL task completed successfully for integration ${integrationId}`);

  } catch (error: any) {
    console.error(`[Worker] ETL task failed:`, error.message);
    
    // Log error
    try {
      await pool.query(`
        INSERT INTO execution_logs (integration_id, status, error_message)
        VALUES ($1, $2, $3)
      `, [integrationId, "error", error.message]);
    } catch (logError) {
      console.error("[Worker] Failed to log error to database:", logError);
    }
  }
}
