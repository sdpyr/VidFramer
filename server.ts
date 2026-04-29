import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for audio data
  app.use(express.json({ limit: "50mb" }));
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && (err as any).status === 400 && "body" in err) {
      console.error("Express body parsing error:", err.message);
      return res.status(400).send({ error: "Invalid JSON payload" });
    }
    if (err.type === "entity.too.large") {
      console.error("Express body too large:", err.message);
      return res.status(413).send({ error: "Payload too large" });
    }
    next();
  });

  // API Route for health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
