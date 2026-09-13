import express from "express";

// src/server.js is also used for local development and starts its own HTTP
// listener. On Vercel, we only need the Express app as the serverless handler.
const originalListen = express.application.listen;
express.application.listen = function () {
  return this;
};

const { default: app } = await import("../src/server.js");

express.application.listen = originalListen;

export default app;
