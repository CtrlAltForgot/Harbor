import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { z } from "zod";
import type { AddTorrentRequest, EventMessage, Torrent } from "@harbor/contracts";
import { loadConfig, type Config } from "./config.js";
import { createTorrent, tick } from "./engine.js";
import { Store } from "./store.js";

const addSchema = z.object({ magnet: z.string().optional(), torrentBase64: z.string().optional(), fileName: z.string().optional(), category: z.enum(["auto","movie","tv","game","music","software","book","general","review"]).default("auto"), retention: z.enum(["seed","stop","remove","ask"]).default("seed"), mode: z.enum(["server","local"]).default("server") }).refine(v => !!v.magnet !== !!v.torrentBase64, "Provide exactly one torrent source");

export async function buildApp(overrides: Partial<Config> = {}) {
  const config = loadConfig(overrides); const store = new Store(config.dataDir); const started = Date.now();
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" ? { redact: ["req.headers.authorization", "body.torrentBase64"] } : false });
  await app.register(cors, { origin: true }); await app.register(websocket);
  const clients = new Set<{ send(data: string): void; readyState: number }>();
  const broadcast = (message: EventMessage) => { const data = JSON.stringify(message); for (const client of clients) if (client.readyState === 1) client.send(data); };

  app.get("/health", async () => ({ ok: true, service: "Harbor Companion" }));
  app.post("/api/v1/pair", async (request, reply) => {
    const body = z.object({ code: z.string(), label: z.string().min(1).max(100).default("Desktop") }).safeParse(request.body);
    if (!body.success || body.data.code !== config.pairingCode) return reply.code(401).send({ error: "Pairing code is not valid" });
    const token = store.issueToken(body.data.label); store.audit("client.paired", null, { label: body.data.label });
    return { token, serverName: "Harbor on Unraid" };
  });
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/v1/") || request.url === "/api/v1/pair") return;
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token || !store.validToken(token)) return reply.code(401).send({ error: "A valid Harbor pairing token is required" });
  });
  app.get("/api/v1/status", async () => { const torrents = store.list(); return { name: "Harbor on Unraid", version: "0.1.0", paired: true, engine: config.engine, uptime: Math.floor((Date.now()-started)/1000), downloadSpeed: torrents.reduce((n,t)=>n+t.downloadSpeed,0), uploadSpeed: torrents.reduce((n,t)=>n+t.uploadSpeed,0) }; });
  app.get("/api/v1/torrents", async () => store.list());
  app.get("/api/v1/torrents/:id", async (request, reply) => store.get((request.params as any).id) ?? reply.code(404).send({ error: "Torrent not found" }));
  app.post("/api/v1/torrents", async (request, reply) => {
    const parsed = addSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    try { const torrent = createTorrent(parsed.data as AddTorrentRequest, config.destinations); const duplicate = store.byHash(torrent.infoHash); if (duplicate) return reply.code(409).send({ error: "This torrent is already in Harbor", torrent: duplicate }); store.save(torrent); store.audit("torrent.submitted", torrent.id, { source: torrent.source, category: torrent.category }); broadcast({ type: "torrent.updated", torrent }); return reply.code(201).send(torrent); }
    catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Torrent could not be added" }); }
  });
  app.post("/api/v1/torrents/:id/:action", async (request, reply) => {
    const { id, action } = request.params as {id:string;action:string}; const current = store.get(id); if (!current) return reply.code(404).send({error:"Torrent not found"});
    if (!(["pause","resume","retry"] as const).includes(action as any)) return reply.code(400).send({error:"Unsupported action"});
    const next: Torrent = {...current, status: action === "pause" ? "paused" : "queued", error: undefined}; store.save(next); store.audit(`torrent.${action}`, id, {}); broadcast({type:"torrent.updated",torrent:next}); return next;
  });
  app.delete("/api/v1/torrents/:id", async (request, reply) => { const id=(request.params as any).id; if(!store.get(id)) return reply.code(404).send({error:"Torrent not found"}); store.remove(id); broadcast({type:"torrent.removed",torrentId:id}); return reply.code(204).send(); });
  app.get("/api/v1/events", { websocket: true }, socket => { clients.add(socket); socket.send(JSON.stringify({type:"snapshot",torrents:store.list()} satisfies EventMessage)); socket.on("close",()=>clients.delete(socket)); });
  const timer = config.engine === "mock" ? setInterval(() => { for (const torrent of store.list()) { const next=tick(torrent); if(next!==torrent){store.save(next);broadcast({type:"torrent.updated",torrent:next});} } }, 1000) : undefined;
  app.addHook("onClose", async () => { if(timer) clearInterval(timer); store.close(); });
  return app;
}
