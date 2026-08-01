import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import staticFiles from "@fastify/static";
import { z } from "zod";
import type { AddTorrentRequest, EventMessage, Torrent } from "@harbor/contracts";
import { loadConfig, type Config } from "./config.js";
import { createTorrent, tick } from "./engine.js";
import { Store } from "./store.js";
import { QbitClient } from "./qbittorrent.js";
import { classify } from "./classifier.js";
import { organize } from "./organizer.js";
import path from "node:path";
import { access,stat } from "node:fs/promises";
import { constants } from "node:fs";

const addSchema = z.object({ magnet: z.string().optional(), torrentBase64: z.string().optional(), fileName: z.string().optional(), category: z.enum(["auto","movie","tv","game","music","software","book","general","review"]).default("auto"), retention: z.enum(["seed","stop","remove","ask"]).default("seed"), mode: z.enum(["server","local"]).default("server") }).refine(v => !!v.magnet !== !!v.torrentBase64, "Provide exactly one torrent source");

export async function buildApp(overrides: Partial<Config> = {}) {
  const config = loadConfig(overrides); const store = new Store(config.dataDir); const started = Date.now();
  const qbit = config.engine === "qbittorrent" ? new QbitClient(config) : undefined;
  const app = Fastify({ bodyLimit:15*1024*1024,logger: process.env.NODE_ENV !== "test" ? { redact: ["req.headers.authorization", "body.torrentBase64"] } : false });
  await app.register(cors, { origin: true }); await app.register(websocket);
  if(config.uiDir)await app.register(staticFiles,{root:config.uiDir,wildcard:false});
  const clients = new Set<{ send(data: string): void; readyState: number }>();
  const broadcast = (message: EventMessage) => { const data = JSON.stringify(message); for (const client of clients) if (client.readyState === 1) client.send(data); };

  app.get("/health", async () => ({ ok: true, service: "Harbor Companion" }));
  if(config.uiDir)app.setNotFoundHandler((request,reply)=>request.method==="GET"&&!request.url.startsWith("/api/")?reply.sendFile("index.html"):reply.code(404).send({error:"Not found"}));
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
  app.get("/api/v1/status", async () => { const torrents = store.list();let engineConnected=true,engineError:string|undefined;try{await qbit?.health();}catch(error){engineConnected=false;engineError=error instanceof Error?error.message:"qBittorrent unavailable";}const storageIssues:string[]=[];for(const [label,target] of Object.entries({incomplete:config.incompleteDir,...config.destinations})){try{await access(target,constants.R_OK|constants.W_OK);if(!(await stat(target)).isDirectory())storageIssues.push(`${label}: not a directory`);}catch{storageIssues.push(`${label}: unavailable or not writable`);}}return { name: "Harbor on Unraid", version: "0.1.0", paired: true, engine: config.engine,engineConnected,engineError,storageReady:storageIssues.length===0,storageIssues, uptime: Math.floor((Date.now()-started)/1000), downloadSpeed: torrents.reduce((n,t)=>n+t.downloadSpeed,0), uploadSpeed: torrents.reduce((n,t)=>n+t.uploadSpeed,0) }; });
  app.get("/api/v1/torrents", async () => store.list());
  app.get("/api/v1/torrents/:id", async (request, reply) => store.get((request.params as any).id) ?? reply.code(404).send({ error: "Torrent not found" }));
  app.post("/api/v1/torrents", async (request, reply) => {
    const parsed = addSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    try { const input=parsed.data as AddTorrentRequest;const torrent = createTorrent(input, config.destinations); const duplicate = store.byHash(torrent.infoHash); if (duplicate) return reply.code(409).send({ error: "This torrent is already in Harbor", torrent: duplicate });if(qbit){const category=torrent.classification.category;if(input.magnet)await qbit.addMagnet(input.magnet,category);else await qbit.addFile(Buffer.from(input.torrentBase64!,"base64"),input.fileName??`${torrent.name}.torrent`,category);}store.save(torrent); store.audit("torrent.submitted", torrent.id, { source: torrent.source, category: torrent.category }); broadcast({ type: "torrent.updated", torrent }); return reply.code(201).send(torrent); }
    catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Torrent could not be added" }); }
  });
  app.post("/api/v1/torrents/:id/:action", async (request, reply) => {
    const { id, action } = request.params as {id:string;action:string}; const current = store.get(id); if (!current) return reply.code(404).send({error:"Torrent not found"});
    if (!(["pause","resume","retry","recheck"] as const).includes(action as any)) return reply.code(400).send({error:"Unsupported action"});
    if(qbit)await qbit.action(current.infoHash,action==="retry"?"resume":action as "pause"|"resume"|"recheck");const next: Torrent = {...current, status: action === "pause" ? "paused" : "queued", error: undefined}; store.save(next); store.audit(`torrent.${action}`, id, {}); broadcast({type:"torrent.updated",torrent:next}); return next;
  });
  app.post("/api/v1/torrents/:id/files/priority",async(request,reply)=>{const id=(request.params as any).id;const current=store.get(id);if(!current)return reply.code(404).send({error:"Torrent not found"});const parsed=z.object({ids:z.array(z.number().int().nonnegative()).min(1),priority:z.number().int().min(0).max(7)}).safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:"Invalid file priority"});if(qbit)await qbit.setFilePriority(current.infoHash,parsed.data.ids,parsed.data.priority);store.audit("torrent.file_priority",id,parsed.data);return reply.code(204).send();});
  app.post("/api/v1/torrents/:id/limits",async(request,reply)=>{const id=(request.params as any).id;const current=store.get(id);if(!current)return reply.code(404).send({error:"Torrent not found"});const parsed=z.object({download:z.number().int().min(0),upload:z.number().int().min(0)}).safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:"Invalid speed limits"});if(qbit)await qbit.setLimits(current.infoHash,parsed.data.download,parsed.data.upload);store.audit("torrent.limits",id,parsed.data);return reply.code(204).send();});
  app.patch("/api/v1/torrents/:id/classification",async(request,reply)=>{const id=(request.params as any).id;const current=store.get(id);if(!current)return reply.code(404).send({error:"Torrent not found"});const parsed=z.object({category:z.enum(["movie","tv","game","music","software","book","general","review"]),title:z.string().min(1).max(240),season:z.number().int().min(0).max(200).optional(),episode:z.number().int().min(0).max(1000).optional()}).safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:"Invalid classification correction"});const next:Torrent={...current,category:parsed.data.category,classification:{...parsed.data,confidence:1,reasons:["manual correction"]},destination:config.destinations[parsed.data.category]??config.destinations.review!,status:current.progress>=1?"completed":current.status,error:undefined};store.save(next);store.audit("classification.corrected",id,parsed.data);broadcast({type:"torrent.updated",torrent:next});return next;});
  app.delete("/api/v1/torrents/:id", async (request, reply) => { const id=(request.params as any).id;const current=store.get(id); if(!current) return reply.code(404).send({error:"Torrent not found"});if(qbit)await qbit.remove(current.infoHash,false); store.remove(id); broadcast({type:"torrent.removed",torrentId:id}); return reply.code(204).send(); });
  app.get("/api/v1/events", { websocket: true }, socket => { clients.add(socket); socket.send(JSON.stringify({type:"snapshot",torrents:store.list()} satisfies EventMessage)); socket.on("close",()=>clients.delete(socket)); });
  let syncing=false;const timer = setInterval(async() => {if(syncing)return;syncing=true;try{if(qbit){const remote=await qbit.list();const byHash=new Map(remote.map(item=>[item.hash.toLowerCase(),item]));for(const torrent of store.list()){const found=byHash.get(torrent.infoHash.toLowerCase());if(!found)continue;let next=await qbit.sync(torrent,found);if(next.category==="auto"&&next.files.length){const detected=classify(next.name,next.files.map(file=>file.name));next={...next,classification:detected,destination:config.destinations[detected.category]??config.destinations.review!};if(next.progress>=1&&detected.confidence<.6)next.status="review";}if(next.status==="completed"&&next.classification.confidence>=.6){try{const source=found.content_path||path.join(found.save_path,found.name);const relative=path.relative(path.resolve(config.incompleteDir),path.resolve(source));if(relative.startsWith("..")||path.isAbsolute(relative))throw new Error("qBittorrent content path is outside incomplete storage");const result=await organize(source,next.destination,next.classification);next={...next,status:"organized"};store.audit("organization.completed",next.id,result);if(next.retention==="stop")await qbit.action(next.infoHash,"pause");else if(next.retention==="remove")await qbit.remove(next.infoHash,false);}catch(error){next={...next,status:"failed",error:error instanceof Error?error.message:"Organization failed"};store.audit("organization.failed",next.id,{error:next.error});}}store.save(next);broadcast({type:"torrent.updated",torrent:next});}}else{for (const torrent of store.list()) { const next=tick(torrent); if(next!==torrent){store.save(next);broadcast({type:"torrent.updated",torrent:next});} }} }catch(error){app.log.warn({err:error},"torrent engine synchronization failed");}finally{syncing=false;}}, 1000);
  app.addHook("onClose", async () => { if(timer) clearInterval(timer); store.close(); });
  return app;
}
