import { Router } from "express";
import { db } from "./db";
import { encrypt } from "./crypto";
import { runETLTask } from "./worker";

const router = Router();

// Create a new integration
router.post("/integrations", (req, res) => {
  const { userId, name, customUrl, httpMethod, headersConfig, dataMapping, outputType, destinationDb, targetTable } = req.body;

  try {
    const encryptedHeaders = encrypt(JSON.stringify(headersConfig || []));
    const mappingStr = JSON.stringify(dataMapping || []);

    const result = db.prepare(`
      INSERT INTO integrations (user_id, name, custom_url, http_method, encrypted_headers, data_mapping, output_type, destination_db_string, target_table)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name, customUrl, httpMethod, encryptedHeaders, mappingStr, outputType, destinationDb || null, targetTable || null);

    res.json({ success: true, integrationId: result.lastInsertRowid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all integrations for a user
router.get("/integrations/:userId", (req, res) => {
  try {
    const integrations = db.prepare(`
      SELECT id, name, custom_url, http_method, output_type, destination_db_string, target_table, status, created_at 
      FROM integrations 
      WHERE user_id = ?
    `).all(req.params.userId);
    
    res.json(integrations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger ETL task manually
router.post("/integrations/:id/sync", (req, res) => {
  const integrationId = parseInt(req.params.id);
  
  // Run task in background (simulating a worker)
  runETLTask(integrationId);
  
  res.json({ success: true, message: "Sync task started in background" });
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
      headers
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
    }

    res.json({ success: true, sample });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update an integration
router.put("/integrations/:id", (req, res) => {
  const integrationId = req.params.id;
  const { name, customUrl, httpMethod, headersConfig, dataMapping, outputType, destinationDb, targetTable } = req.body;

  try {
    // Se headersConfig for enviado e não estiver vazio, atualiza. Caso contrário, mantém o antigo.
    // Para simplificar, vamos assumir que o frontend sempre envia o headersConfig completo, 
    // mas se o usuário quiser manter os headers ocultos, ele pode enviar um array vazio.
    // Vamos atualizar sempre, então o frontend precisa enviar os headers corretos.
    const encryptedHeaders = encrypt(JSON.stringify(headersConfig || []));
    const mappingStr = JSON.stringify(dataMapping || []);

    db.prepare(`
      UPDATE integrations 
      SET name = ?, custom_url = ?, http_method = ?, encrypted_headers = ?, data_mapping = ?, output_type = ?, destination_db_string = ?, target_table = ?
      WHERE id = ?
    `).run(name, customUrl, httpMethod, encryptedHeaders, mappingStr, outputType, destinationDb || null, targetTable || null, integrationId);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an integration
router.delete("/integrations/:id", (req, res) => {
  const integrationId = req.params.id;
  try {
    // Delete logs first to maintain referential integrity
    db.prepare("DELETE FROM execution_logs WHERE integration_id = ?").run(integrationId);
    // Delete the integration
    db.prepare("DELETE FROM integrations WHERE id = ?").run(integrationId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get execution logs
router.get("/integrations/:id/logs", (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM execution_logs 
      WHERE integration_id = ? 
      ORDER BY executed_at DESC 
      LIMIT 10
    `).all(req.params.id);
    
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
