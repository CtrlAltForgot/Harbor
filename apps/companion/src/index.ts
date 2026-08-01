import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig(); const app = await buildApp(config);
try { await app.listen({ host: config.host, port: config.port }); app.log.info({ pairingCode: config.pairingCode, engine: config.engine }, "Harbor Companion ready; protect this one-time pairing code"); }
catch (error) { app.log.error(error); process.exit(1); }
