import { Router } from "express";
import { pool } from "./db.js";
import { encrypt } from "./crypto.js";
import { runETLTask } from "./worker.js";
import { requireAuth } from "./authMiddleware.js";

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Get current user info
router.get("/me", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const integrationsCount = await pool.query('SELECT COUNT(*) FROM integrations WHERE user_id = $1', [req.user.id]);
    
    res.json({
      ...result.rows[0],
      integrations_count: parseInt(integrationsCount.rows[0].count)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put("/me", async (req, res) => {
  const { name } = req.body;
  try {
    await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, req.user.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new integration
router.post("/integrations", async (req, res) => {
  const { name, customUrl, httpMethod, headersConfig, dataMapping, outputType, destinationDb, targetTable } = req.body;

  try {
    // Check limits
    const userResult = await pool.query('SELECT integrations_limit FROM users WHERE id = $1', [req.user.id]);
    const countResult = await pool.query('SELECT COUNT(*) FROM integrations WHERE user_id = $1', [req.user.id]);
    
    const limit = userResult.rows[0]?.integrations_limit || 3;
    const currentCount = parseInt(countResult.rows[0].count);

    if (currentCount >= limit) {
      return res.status(403).json({ error: "Limite de integrações atingido para o seu plano. Faça upgrade para criar mais." });
    }

    const encryptedHeaders = encrypt(JSON.stringify(headersConfig || []));
    const mappingStr = JSON.stringify(dataMapping || []);

    const result = await pool.query(`
      INSERT INTO integrations (user_id, name, custom_url, http_method, encrypted_headers, data_mapping, output_type, destination_db_string, target_table)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [req.user.id, name, customUrl, httpMethod, encryptedHeaders, mappingStr, outputType, destinationDb || null, targetTable || null]);

    res.json({ success: true, integrationId: result.rows[0].id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all integrations for the authenticated user
router.get("/integrations", async (req, res) => {
  try {
    const integrations = await pool.query(`
      SELECT id, name, custom_url, http_method, output_type, destination_db_string, target_table, status, created_at 
      FROM integrations 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [req.user.id]);
    
    res.json(integrations.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger ETL task manually
router.post("/integrations/:id/sync", async (req, res) => {
  const integrationId = parseInt(req.params.id);
  
  try {
    // Validate ownership
    const result = await pool.query('SELECT id FROM integrations WHERE id = $1 AND user_id = $2', [integrationId, req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Integração não encontrada ou acesso negado." });
    }

    // Run task in background
    runETLTask(integrationId);
    
    res.json({ success: true, message: "Sync task started in background" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test fetch for auto-discovery
router.post("/integrations/test-fetch", async (req, res) => {
  const { customUrl, httpMethod, headersConfig } = req.body;

  try {
    const headers: Record<string, string> = {};
    if (Array.isArray(headersConfig)) {
      headersConfig.forEach((h: any) => {
        if (h.key && h.value) headers[h.key] = h.value;
      });
    }

    const response = await fetch(customUrl, {
      method: httpMethod,
      headers,
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return res.status(response.status).json({ error: `API Error: ${response.status} ${response.statusText} - ${errorText}` });
    }

    let data = await response.json();
    
    // Get sample object
    let sample = data;
    if (Array.isArray(data)) {
      sample = data.length > 0 ? data[0] : {};
    } else if (data && typeof data === 'object' && data.data && Array.isArray(data.data)) {
      // Auto-detect common wrapper
      sample = data.data.length > 0 ? data.data[0] : {};
    }

    res.json({ success: true, sample });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update an integration
router.put("/integrations/:id", async (req, res) => {
  const integrationId = req.params.id;
  const { name, customUrl, httpMethod, headersConfig, dataMapping, outputType, destinationDb, targetTable } = req.body;

  try {
    // Validate ownership
    const check = await pool.query('SELECT id FROM integrations WHERE id = $1 AND user_id = $2', [integrationId, req.user.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Integração não encontrada ou acesso negado." });
    }

    const encryptedHeaders = encrypt(JSON.stringify(headersConfig || []));
    const mappingStr = JSON.stringify(dataMapping || []);

    await pool.query(`
      UPDATE integrations 
      SET name = $1, custom_url = $2, http_method = $3, encrypted_headers = $4, data_mapping = $5, output_type = $6, destination_db_string = $7, target_table = $8, updated_at = NOW()
      WHERE id = $9 AND user_id = $10
    `, [name, customUrl, httpMethod, encryptedHeaders, mappingStr, outputType, destinationDb || null, targetTable || null, integrationId, req.user.id]);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an integration
router.delete("/integrations/:id", async (req, res) => {
  const integrationId = req.params.id;
  try {
    // Validate ownership
    const check = await pool.query('SELECT id FROM integrations WHERE id = $1 AND user_id = $2', [integrationId, req.user.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Integração não encontrada ou acesso negado." });
    }

    // Delete logs first (though CASCADE should handle it if set up, but let's be explicit or rely on REFERENCES ... ON DELETE CASCADE)
    await pool.query("DELETE FROM execution_logs WHERE integration_id = $1", [integrationId]);
    // Delete the integration
    await pool.query("DELETE FROM integrations WHERE id = $1 AND user_id = $2", [integrationId, req.user.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get execution logs
router.get("/integrations/:id/logs", async (req, res) => {
  const integrationId = req.params.id;
  try {
    // Validate ownership
    const check = await pool.query('SELECT id FROM integrations WHERE id = $1 AND user_id = $2', [integrationId, req.user.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Integração não encontrada ou acesso negado." });
    }

    const logs = await pool.query(`
      SELECT * FROM execution_logs 
      WHERE integration_id = $1 
      ORDER BY executed_at DESC 
      LIMIT 20
    `, [integrationId]);
    
    res.json(logs.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
