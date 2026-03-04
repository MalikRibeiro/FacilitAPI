import express from "express";
import { createServer as createViteServer } from "vite";
import helmet from "helmet";
import cors from "cors";
import { runMigrations } from "./src/server/migrations.js";
import apiRoutes from "./src/server/routes.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development with Vite
    crossOriginEmbedderPolicy: false
  }));
  
  app.use(cors({
    origin: process.env.APP_URL || '*',
    credentials: true
  }));

  app.use(express.json());
  app.use(express.static("public"));

  // Initialize Database (Migrations)
  try {
    await runMigrations();
  } catch (error) {
    console.error("Failed to run migrations. Server will start but might be unstable.", error);
  }

  // API routes FIRST
  app.use("/api", apiRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    
    // SPA Fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
