import express from "express";

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => {
  res.json({ name: "SEDAR Agent", status: "ok", channel: "telegram", agent: true, version: "3.0.0" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), agent: "SEDAR Agent" });
});

app.use(async (req, res, next) => {
  try {
    const { app: sedarApp } = await import("../src/server.js");
    return sedarApp(req, res, next);
  } catch (error) {
    console.error("SEDAR Agent bootstrap error:", error);
    return res.status(500).json({
      status: "error",
      agent: "SEDAR Agent",
      message: "SEDAR Agent runtime bootstrap failed"
    });
  }
});

export default app;
