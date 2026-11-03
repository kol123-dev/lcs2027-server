import express from "express";
import { fileURLToPath } from "node:url";
import env from "./config/env.js";
import corsConfig from "./config/cors.js";
import apiRoutes from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");
app.use(corsConfig());
app.use(express.json());

// Health endpoint — deliberately outside /api to bypass CORS & auth
// so standard uptime monitors can poll it.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "siyoi-campaign-api", time: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({ name: "Lillian Siyoi 2027 Campaign API", docs: "/api" });
});

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Only bind when run directly (`node src/index.js`) or managed by PM2,
// never when the app is imported by the test runner.
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const isPM2 = "pm_id" in process.env;

if ((isMainModule || isPM2) && env.nodeEnv !== "test") {
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] Siyoi 2027 campaign API listening on :${env.port} (${env.nodeEnv})`);
  });
}

export default app;