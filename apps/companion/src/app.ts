import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import staticFiles from "@fastify/static";
import { z } from "zod";
import type {
  AddTorrentRequest,
  EventMessage,
  HarborSettings,
  QbitEngineInfo,
  QbitPreferences,
  OrganizationProgress,
  Torrent,
} from "@harbor/contracts";
import { loadConfig, type Config } from "./config.js";
import { createTorrent, tick } from "./engine.js";
import { Store } from "./store.js";
import { QbitClient } from "./qbittorrent.js";
import { classify, recoverMetadataDemotion } from "./classifier.js";
import { cleanupStaging, organize } from "./organizer.js";
import { TmdbMatcher } from "./metadata.js";
import path from "node:path";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";

const addSchema = z
  .object({
    magnet: z.string().optional(),
    torrentBase64: z.string().optional(),
    fileName: z.string().optional(),
    category: z
      .enum([
        "auto",
        "movie",
        "tv",
        "game",
        "music",
        "software",
        "book",
        "general",
        "review",
      ])
      .default("auto"),
    retention: z.enum(["seed", "stop", "remove", "ask"]).default("remove"),
    mode: z.enum(["server", "local"]).default("server"),
  })
  .refine(
    (v) => !!v.magnet !== !!v.torrentBase64,
    "Provide exactly one torrent source",
  );

export const qbitPreferencesSchema = z.object({
  savePath: z.string(),
  tempPath: z.string(),
  tempPathEnabled: z.boolean(),
  createSubfolder: z.boolean(),
  preallocateAll: z.boolean(),
  incompleteExtension: z.boolean(),
  startPaused: z.boolean(),
  listenPort: z.number().int().min(1).max(65535),
  upnp: z.boolean(),
  maxConnections: z.number().int().min(-1).max(1_000_000),
  maxConnectionsPerTorrent: z.number().int().min(-1).max(1_000_000),
  maxUploadsPerTorrent: z.number().int().min(-1).max(1_000_000),
  downloadLimit: z.number().int().min(0),
  uploadLimit: z.number().int().min(0),
  alternativeDownloadLimit: z.number().int().min(0),
  alternativeUploadLimit: z.number().int().min(0),
  queueingEnabled: z.boolean(),
  maxActiveDownloads: z.number().int().min(-1).max(100_000),
  maxActiveUploads: z.number().int().min(-1).max(100_000),
  maxActiveTorrents: z.number().int().min(-1).max(100_000),
  dontCountSlowTorrents: z.boolean(),
  dht: z.boolean(),
  pex: z.boolean(),
  lsd: z.boolean(),
  encryption: z.number().int().min(0).max(2),
  anonymousMode: z.boolean(),
  maxRatioEnabled: z.boolean(),
  maxRatio: z.number().min(-1),
  maxRatioAction: z.number().int().min(0).max(1),
  maxSeedingTimeEnabled: z.boolean(),
  maxSeedingTime: z.number().int().min(-1),
  schedulerEnabled: z.boolean(),
  scheduleFromHour: z.number().int().min(0).max(23),
  scheduleFromMinute: z.number().int().min(0).max(59),
  scheduleToHour: z.number().int().min(0).max(23),
  scheduleToMinute: z.number().int().min(0).max(59),
  schedulerDays: z.number().int().min(0).max(9),
  proxyType: z.number().int().min(-1).max(5),
  proxyAddress: z.string().max(255),
  proxyPort: z.number().int().min(0).max(65535),
  proxyPeerConnections: z.boolean(),
  proxyAuthEnabled: z.boolean(),
  proxyUsername: z.string().max(255),
  proxyPassword: z.string().max(1024),
  proxyPasswordConfigured: z.boolean(),
  proxyTorrentsOnly: z.boolean(),
});

export async function buildApp(overrides: Partial<Config> = {}) {
  const config = loadConfig(overrides);
  const store = new Store(config.dataDir);
  const started = Date.now();
  const mediaRoot = config.mediaRoot;
  for (const [category, value] of Object.entries(config.destinations)) {
    const saved = store.setting(`destination.${category}`);
    if (saved) config.destinations[category] = saved;
    else store.setSetting(`destination.${category}`, value);
  }
  let tmdbToken =
    store.setting("tmdb.accessToken") ?? process.env.TMDB_ACCESS_TOKEN ?? "";
  let metadataLanguage = store.setting("metadata.language") ?? "en-US";
  if (config.mediaHostRoot)
    for (const torrent of store.list())
      if (torrent.organizedPath && !torrent.organizedHostPath)
        store.save({
          ...torrent,
          organizedHostPath: hostMediaPath(config, torrent.organizedPath),
        });
  const qbit =
    config.engine === "qbittorrent" ? new QbitClient(config) : undefined;
  const app = Fastify({
    bodyLimit: 15 * 1024 * 1024,
    logger:
      process.env.NODE_ENV !== "test"
        ? { redact: ["req.headers.authorization", "body.torrentBase64"] }
        : false,
  });
  await app.register(cors, { origin: true });
  await app.register(websocket);
  if (config.uiDir)
    await app.register(staticFiles, { root: config.uiDir, wildcard: false });
  const clients = new Set<{ send(data: string): void; readyState: number }>();
  const broadcast = (message: EventMessage) => {
    const data = JSON.stringify(message);
    for (const client of clients)
      if (client.readyState === 1) client.send(data);
  };

  app.get("/health", async () => ({ ok: true, service: "Harbor Companion" }));
  if (config.uiDir)
    app.setNotFoundHandler((request, reply) =>
      request.method === "GET" && !request.url.startsWith("/api/")
        ? reply.sendFile("index.html")
        : reply.code(404).send({ error: "Not found" }),
    );
  app.post("/api/v1/pair", async (request, reply) => {
    const body = z
      .object({
        code: z.string(),
        label: z.string().min(1).max(100).default("Desktop"),
      })
      .safeParse(request.body);
    if (!body.success || body.data.code !== config.pairingCode)
      return reply.code(401).send({ error: "Pairing code is not valid" });
    const token = store.issueToken(body.data.label);
    store.audit("client.paired", null, { label: body.data.label });
    return { token, serverName: "Harbor on Unraid" };
  });
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/v1/") || request.url === "/api/v1/pair")
      return;
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token || !store.validToken(token))
      return reply
        .code(401)
        .send({ error: "A valid Harbor pairing token is required" });
  });
  app.get("/api/v1/status", async () => {
    const torrents = store.list();
    let engineConnected = true,
      engineError: string | undefined;
    try {
      await qbit?.health();
    } catch (error) {
      engineConnected = false;
      engineError =
        error instanceof Error ? error.message : "qBittorrent unavailable";
    }
    const storageIssues: string[] = [];
    for (const [label, target] of Object.entries({
      incomplete: config.incompleteDir,
      ...config.destinations,
    })) {
      try {
        await access(target, constants.R_OK | constants.W_OK);
        if (!(await stat(target)).isDirectory())
          storageIssues.push(`${label}: not a directory`);
      } catch {
        storageIssues.push(`${label}: unavailable or not writable`);
      }
    }
    return {
      name: "Harbor on Unraid",
      version: "0.1.0",
      paired: true,
      engine: config.engine,
      engineConnected,
      engineError,
      storageReady: storageIssues.length === 0,
      storageIssues,
      uptime: Math.floor((Date.now() - started) / 1000),
      downloadSpeed: torrents.reduce((n, t) => n + t.downloadSpeed, 0),
      uploadSpeed: torrents.reduce((n, t) => n + t.uploadSpeed, 0),
    };
  });
  app.get("/api/v1/torrents", async () => store.list());
  app.get("/api/v1/engine/preferences", async (request, reply) => {
    if (!qbit)
      return reply.code(400).send({ error: "qBittorrent is not configured" });
    return mapQbitPreferences(await qbit.preferences());
  });
  app.put("/api/v1/engine/preferences", async (request, reply) => {
    if (!qbit)
      return reply.code(400).send({ error: "qBittorrent is not configured" });
    const parsed = qbitPreferencesSchema.safeParse(request.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.join(".") || "unknown field";
      return reply.code(400).send({
        error: `Invalid qBittorrent setting: ${field} — ${issue?.message ?? "invalid value"}`,
      });
    }
    await qbit.setPreferences(toQbitPreferences(parsed.data));
    const confirmed = mapQbitPreferences(await qbit.preferences());
    store.audit("engine.preferences_updated", null, {
      ...parsed.data,
      savePath: undefined,
      tempPath: undefined,
      proxyPassword: parsed.data.proxyPassword ? "[updated]" : undefined,
    });
    return confirmed;
  });
  app.get("/api/v1/engine/info", async (request, reply): Promise<QbitEngineInfo | unknown> => {
    if (!qbit)
      return reply.code(400).send({ error: "qBittorrent is not configured" });
    const info = await qbit.engineInfo();
    return {
      ...info,
      recentLogs: info.recentLogs.map((entry) => ({
        ...entry,
        message: sanitizeEngineLog(entry.message),
      })),
    };
  });
  app.post("/api/v1/engine/alternative-speed-limits/toggle", async (request, reply) => {
    if (!qbit)
      return reply.code(400).send({ error: "qBittorrent is not configured" });
    const info = await qbit.toggleAlternativeSpeedLimits();
    store.audit("engine.alternative_speed_limits_toggled", null, {
      enabled: info.alternativeSpeedLimits,
    });
    return { ...info, recentLogs: info.recentLogs.map((entry) => ({ ...entry, message: sanitizeEngineLog(entry.message) })) };
  });
  app.get("/api/v1/settings", async (): Promise<HarborSettings> => ({
    mediaRoot,
    mediaHostRoot: config.mediaHostRoot,
    moviesDir: config.destinations.movie!,
    tvDir: config.destinations.tv!,
    reviewDir: config.destinations.review!,
    tmdbConfigured: !!tmdbToken,
    metadataLanguage,
  }));
  app.get("/api/v1/settings/directories", async (request, reply) => {
    const requested = z
      .object({ path: z.string().default(mediaRoot) })
      .safeParse(request.query);
    if (!requested.success)
      return reply.code(400).send({ error: "Invalid path" });
    const selected = path.resolve(requested.data.path);
    assertMediaPath(mediaRoot, selected);
    try {
      const { readdir } = await import("node:fs/promises");
      const entries = await readdir(selected, { withFileTypes: true });
      return {
        path: selected,
        directories: entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.join(selected, entry.name))
          .sort(),
      };
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : "Folder could not be read",
      });
    }
  });
  app.put("/api/v1/settings", async (request, reply) => {
    const parsed = z
      .object({
        moviesDir: z.string().min(1),
        tvDir: z.string().min(1),
        reviewDir: z.string().min(1),
        metadataLanguage: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
        tmdbAccessToken: z.string().max(1000).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "Invalid Harbor settings" });
    try {
      for (const target of [
        parsed.data.moviesDir,
        parsed.data.tvDir,
        parsed.data.reviewDir,
      ]) {
        assertMediaPath(mediaRoot, target);
        await access(target, constants.R_OK | constants.W_OK);
        if (!(await stat(target)).isDirectory())
          throw new Error(`${target} is not a directory`);
      }
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error
            ? error.message
            : "Storage path is unavailable",
      });
    }
    config.destinations.movie = path.resolve(parsed.data.moviesDir);
    config.destinations.tv = path.resolve(parsed.data.tvDir);
    config.destinations.review = path.resolve(parsed.data.reviewDir);
    metadataLanguage = parsed.data.metadataLanguage;
    for (const category of ["movie", "tv", "review"])
      store.setSetting(
        `destination.${category}`,
        config.destinations[category]!,
      );
    store.setSetting("metadata.language", metadataLanguage);
    if (
      parsed.data.tmdbAccessToken !== undefined &&
      parsed.data.tmdbAccessToken.trim()
    ) {
      tmdbToken = parsed.data.tmdbAccessToken.trim();
      store.setSetting("tmdb.accessToken", tmdbToken);
    }
    store.audit("settings.updated", null, {
      moviesDir: config.destinations.movie,
      tvDir: config.destinations.tv,
      reviewDir: config.destinations.review,
      metadataLanguage,
      tmdbConfigured: !!tmdbToken,
    });
    return {
      mediaRoot,
      mediaHostRoot: config.mediaHostRoot,
      moviesDir: config.destinations.movie,
      tvDir: config.destinations.tv,
      reviewDir: config.destinations.review,
      tmdbConfigured: !!tmdbToken,
      metadataLanguage,
    } satisfies HarborSettings;
  });
  app.get(
    "/api/v1/torrents/:id",
    async (request, reply) =>
      store.get((request.params as any).id) ??
      reply.code(404).send({ error: "Torrent not found" }),
  );
  app.post("/api/v1/torrents", async (request, reply) => {
    const parsed = addSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    try {
      const input = parsed.data as AddTorrentRequest;
      const torrent = createTorrent(input, config.destinations);
      const duplicate = store.byHash(torrent.infoHash);
      if (duplicate)
        return reply.code(409).send({
          error: "This torrent is already in Harbor",
          torrent: duplicate,
        });
      if (qbit) {
        const category = torrent.classification.category;
        if (input.magnet)
          await qbit.addMagnet(input.magnet, category, torrent.infoHash);
        else
          await qbit.addFile(
            Buffer.from(input.torrentBase64!, "base64"),
            input.fileName ?? `${torrent.name}.torrent`,
            category,
            torrent.infoHash,
          );
      }
      store.save(torrent);
      store.audit("torrent.submitted", torrent.id, {
        source: torrent.source,
        category: torrent.category,
      });
      broadcast({ type: "torrent.updated", torrent });
      return reply.code(201).send(torrent);
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : "Torrent could not be added",
      });
    }
  });
  app.post("/api/v1/torrents/:id/:action", async (request, reply) => {
    const { id, action } = request.params as { id: string; action: string };
    const current = store.get(id);
    if (!current) return reply.code(404).send({ error: "Torrent not found" });
    if (action === "reorganize") {
      if (!qbit)
        return reply
          .code(400)
          .send({ error: "Re-organization requires qBittorrent" });
      try {
        const remote = (await qbit.list()).find(
          (item) => item.hash.toLowerCase() === current.infoHash.toLowerCase(),
        );
        if (!remote)
          throw new Error(
            "The original qBittorrent job is no longer available",
          );
        const source =
          remote.content_path || path.join(remote.save_path, remote.name);
        const relative = path.relative(
          path.resolve(config.incompleteDir),
          path.resolve(source),
        );
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
          throw new Error("The original content is outside incomplete storage");
        const destination =
          config.destinations[current.classification.category] ??
          config.destinations.review!;
        let processing: Torrent = {
          ...current,
          destination,
          status: "processing",
          downloadSpeed: 0,
          uploadSpeed: 0,
          etaSeconds: null,
          organization: { phase: "preparing", progress: 0, bytesProcessed: 0, totalBytes: 0, filesProcessed: 0, totalFiles: 0 },
          error: undefined,
        };
        store.save(processing);
        broadcast({ type: "torrent.updated", torrent: processing });
        const result = await organize(
          source,
          destination,
          current.classification,
          (organization) => {
            processing = { ...processing, organization };
            store.save(processing);
            broadcast({ type: "torrent.updated", torrent: processing });
          },
        );
        await qbit.remove(current.infoHash, false);
        await cleanupStaging(source, config.incompleteDir);
        const next: Torrent = {
          ...current,
          destination,
          organizedPath: result.destination,
          organizedHostPath: hostMediaPath(config, result.destination),
          retention: "remove",
          status: "organized",
          organization: undefined,
          error: undefined,
        };
        store.save(next);
        store.audit("organization.rerun_completed", id, result);
        store.audit("staging.cleaned", id, {
          source,
          afterReorganization: true,
        });
        broadcast({ type: "torrent.updated", torrent: next });
        return next;
      } catch (error) {
        const failed: Torrent = {
          ...current,
          status: "failed",
          organization: undefined,
          error: error instanceof Error ? error.message : "Re-organization failed",
        };
        store.save(failed);
        broadcast({ type: "torrent.updated", torrent: failed });
        return reply
          .code(400)
          .send({
            error:
              error instanceof Error ? error.message : "Re-organization failed",
          });
      }
    }
    if (
      !(["pause", "resume", "retry", "recheck", "reannounce", "queue-up", "queue-down", "queue-top", "queue-bottom"] as const).includes(
        action as any,
      )
    )
      return reply.code(400).send({ error: "Unsupported action" });
    if (qbit) {
      const commands = { reannounce: "reannounce", "queue-up": "increasePrio", "queue-down": "decreasePrio", "queue-top": "topPrio", "queue-bottom": "bottomPrio" } as const;
      try {
        if (action in commands) await qbit.command(current.infoHash, commands[action as keyof typeof commands]);
        else await qbit.action(current.infoHash, action === "retry" ? "resume" : (action as "pause" | "resume" | "recheck"));
      } catch (error) {
        return reply.code(502).send({
          error: `${action.replaceAll("-", " ")} failed: ${error instanceof Error ? error.message : "qBittorrent rejected the action"}`,
        });
      }
    }
    const next: Torrent = {
      ...current,
      status: action === "pause" ? "paused" : action === "resume" || action === "retry" ? "queued" : current.status,
      error: undefined,
    };
    store.save(next);
    store.audit(`torrent.${action}`, id, {});
    broadcast({ type: "torrent.updated", torrent: next });
    return next;
  });
  app.post("/api/v1/torrents/:id/files/priority", async (request, reply) => {
    const id = (request.params as any).id;
    const current = store.get(id);
    if (!current) return reply.code(404).send({ error: "Torrent not found" });
    const parsed = z
      .object({
        ids: z.array(z.number().int().nonnegative()).min(1),
        priority: z.number().int().min(0).max(7),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "Invalid file priority" });
    if (qbit)
      await qbit.setFilePriority(
        current.infoHash,
        parsed.data.ids,
        parsed.data.priority,
      );
    store.audit("torrent.file_priority", id, parsed.data);
    return reply.code(204).send();
  });
  app.post("/api/v1/torrents/:id/limits", async (request, reply) => {
    const id = (request.params as any).id;
    const current = store.get(id);
    if (!current) return reply.code(404).send({ error: "Torrent not found" });
    const parsed = z
      .object({
        download: z.number().int().min(0),
        upload: z.number().int().min(0),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "Invalid speed limits" });
    if (qbit)
      await qbit.setLimits(
        current.infoHash,
        parsed.data.download,
        parsed.data.upload,
      );
    store.audit("torrent.limits", id, parsed.data);
    return reply.code(204).send();
  });
  app.patch("/api/v1/torrents/:id/retention", async (request, reply) => {
    const id = (request.params as any).id;
    const current = store.get(id);
    if (!current) return reply.code(404).send({ error: "Torrent not found" });
    const parsed = z
      .object({ retention: z.enum(["seed", "stop", "remove", "ask"]) })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "Invalid retention policy" });
    if (
      parsed.data.retention === "remove" &&
      current.status === "organized" &&
      qbit
    ) {
      try {
        if (
          !current.organizedPath ||
          (!(await stat(current.organizedPath)).isDirectory() &&
            !(await stat(current.organizedPath)).isFile())
        )
          throw new Error("The organized library result could not be verified");
        const remote = (await qbit.list()).find(
          (item) => item.hash.toLowerCase() === current.infoHash.toLowerCase(),
        );
        if (remote) {
          const source =
            remote.content_path || path.join(remote.save_path, remote.name);
          await qbit.remove(current.infoHash, false);
          await cleanupStaging(source, config.incompleteDir);
          store.audit("staging.cleaned", id, {
            source,
            requestedAfterOrganization: true,
          });
        }
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : "Staging cleanup failed",
        });
      }
    }
    const next = { ...current, retention: parsed.data.retention };
    store.save(next);
    store.audit("retention.changed", id, parsed.data);
    broadcast({ type: "torrent.updated", torrent: next });
    return next;
  });
  app.patch("/api/v1/torrents/:id/classification", async (request, reply) => {
    const id = (request.params as any).id;
    const current = store.get(id);
    if (!current) return reply.code(404).send({ error: "Torrent not found" });
    const parsed = z
      .object({
        category: z.enum([
          "movie",
          "tv",
          "game",
          "music",
          "software",
          "book",
          "general",
          "review",
        ]),
        title: z.string().min(1).max(240),
        season: z.number().int().min(0).max(200).optional(),
        episode: z.number().int().min(0).max(1000).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ error: "Invalid classification correction" });
    const next: Torrent = {
      ...current,
      category: parsed.data.category,
      classification: {
        ...parsed.data,
        confidence: 1,
        reasons: ["manual correction"],
      },
      destination:
        config.destinations[parsed.data.category] ??
        config.destinations.review!,
      status: current.progress >= 1 ? "completed" : current.status,
      error: undefined,
    };
    store.save(next);
    store.audit("classification.corrected", id, parsed.data);
    broadcast({ type: "torrent.updated", torrent: next });
    return next;
  });
  app.delete("/api/v1/torrents/:id", async (request, reply) => {
    const id = (request.params as any).id;
    const current = store.get(id);
    if (!current) return reply.code(404).send({ error: "Torrent not found" });
    const parsed = z
      .object({ deleteFiles: z.boolean().default(false) })
      .safeParse(request.body ?? {});
    if (!parsed.success)
      return reply.code(400).send({ error: "Invalid removal options" });
    if (qbit) {
      if (parsed.data.deleteFiles) {
        const remote = (await qbit.list()).find(
          (item) => item.hash.toLowerCase() === current.infoHash.toLowerCase(),
        );
        if (!remote)
          return reply.code(400).send({
            error: "qBittorrent no longer has the original files to delete",
          });
        const source =
          remote.content_path || path.join(remote.save_path, remote.name);
        const relative = path.relative(
          path.resolve(config.incompleteDir),
          path.resolve(source),
        );
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
          return reply.code(400).send({
            error: "Refusing to delete files outside Harbor incomplete storage",
          });
      }
      await qbit.remove(current.infoHash, parsed.data.deleteFiles);
    }
    store.remove(id, {
      downloadedDataDeleted: parsed.data.deleteFiles,
    });
    broadcast({ type: "torrent.removed", torrentId: id });
    return reply.code(204).send();
  });
  app.get("/api/v1/events", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.send(
      JSON.stringify({
        type: "snapshot",
        torrents: store.list(),
      } satisfies EventMessage),
    );
    socket.on("close", () => clients.delete(socket));
  });
  let syncing = false;
  const timer = setInterval(async () => {
    if (syncing) return;
    syncing = true;
    try {
      if (qbit) {
        const remote = await qbit.list();
        const byHash = new Map(
          remote.map((item) => [item.hash.toLowerCase(), item]),
        );
        for (const snapshot of store.list()) {
          // Organization can take minutes. A review correction may arrive while
          // an earlier snapshot item is being copied, so reload immediately
          // before reconciling this record instead of overwriting that correction
          // with stale status/classification data.
          const torrent = store.get(snapshot.id);
          if (!torrent) continue;
          const found = byHash.get(torrent.infoHash.toLowerCase());
          if (!found) {
            if (
              torrent.status !== "organized"
            ) {
              const missing: Torrent = {
                ...torrent,
                status: "failed",
                downloadSpeed: 0,
                uploadSpeed: 0,
                etaSeconds: null,
                seeds: 0,
                peers: 0,
                error: "Torrent is not present in qBittorrent",
              };
              store.save(missing);
              store.audit("torrent.missing_from_engine", torrent.id, {});
              broadcast({ type: "torrent.updated", torrent: missing });
            }
            continue;
          }
          let next = await qbit.sync(torrent, found);
          if (
            next.category === "auto" &&
            next.files.length &&
            !next.classification.reasons.includes("files inspected")
          ) {
            let detected = classify(
              next.name,
              next.files.map((file) => file.name),
            );
            detected = {
              ...detected,
              reasons: [...detected.reasons, "files inspected"],
            };
            if (
              tmdbToken &&
              (detected.category === "movie" || detected.category === "tv")
            ) {
              try {
                detected = await new TmdbMatcher(
                  tmdbToken,
                  metadataLanguage,
                ).refine(detected);
              } catch (error) {
                detected = {
                  ...detected,
                  reasons: [
                    ...detected.reasons,
                    "TMDB unavailable; retained local classification",
                  ],
                };
                store.audit("metadata.lookup_failed", next.id, {
                  provider: "tmdb",
                  error:
                    error instanceof Error ? error.message : "lookup failed",
                });
              }
            }
            next = {
              ...next,
              classification: detected,
              destination:
                config.destinations[detected.category] ??
                config.destinations.review!,
            };
            if (next.progress >= 1 && detected.confidence < 0.8)
              next.status = "review";
          }
          const recovered = recoverMetadataDemotion(
            next.classification,
            next.name,
            next.files.map((file) => file.name),
          );
          if (recovered !== next.classification) {
            next = {
              ...next,
              classification: recovered,
              destination:
                config.destinations[recovered.category] ??
                config.destinations.review!,
              status:
                next.progress >= 1 && recovered.confidence >= 0.8
                  ? "completed"
                  : next.status,
            };
            store.audit("classification.local_confidence_restored", next.id, {
              category: recovered.category,
              confidence: recovered.confidence,
            });
          }
          if (
            next.status === "completed" &&
            next.classification.confidence >= 0.8
          ) {
            try {
              const source =
                found.content_path || path.join(found.save_path, found.name);
              const relative = path.relative(
                path.resolve(config.incompleteDir),
                path.resolve(source),
              );
              if (relative.startsWith("..") || path.isAbsolute(relative))
                throw new Error(
                  "qBittorrent content path is outside incomplete storage",
                );
              next = {
                ...next,
                status: "processing",
                downloadSpeed: 0,
                uploadSpeed: 0,
                etaSeconds: null,
                organization: { phase: "preparing", progress: 0, bytesProcessed: 0, totalBytes: 0, filesProcessed: 0, totalFiles: 0 },
              };
              store.save(next);
              broadcast({ type: "torrent.updated", torrent: next });
              const result = await organize(
                source,
                next.destination,
                next.classification,
                (organization: OrganizationProgress) => {
                  next = { ...next, status: "processing", organization };
                  store.save(next);
                  broadcast({ type: "torrent.updated", torrent: next });
                },
              );
              next = {
                ...next,
                status: "organized",
                downloadSpeed: 0,
                uploadSpeed: 0,
                etaSeconds: 0,
                organizedPath: result.destination,
                organizedHostPath: hostMediaPath(config, result.destination),
                organization: undefined,
              };
              store.audit("organization.completed", next.id, result);
              if (next.retention === "stop")
                await qbit.action(next.infoHash, "pause");
              else if (next.retention === "remove") {
                await qbit.remove(next.infoHash, false);
                await cleanupStaging(source, config.incompleteDir);
                store.audit("staging.cleaned", next.id, { source });
              }
            } catch (error) {
              next = {
                ...next,
                status: "failed",
                error:
                  error instanceof Error
                    ? error.message
                    : "Organization failed",
                organization: undefined,
              };
              store.audit("organization.failed", next.id, {
                error: next.error,
              });
            }
          }
          store.save(next);
          broadcast({ type: "torrent.updated", torrent: next });
        }
      } else {
        for (const snapshot of store.list()) {
          const torrent = store.get(snapshot.id);
          if (!torrent) continue;
          const next = tick(torrent);
          if (next !== torrent) {
            store.save(next);
            broadcast({ type: "torrent.updated", torrent: next });
          }
        }
      }
    } catch (error) {
      app.log.warn({ err: error }, "torrent engine synchronization failed");
    } finally {
      syncing = false;
    }
  }, 1000);
  app.addHook("onClose", async () => {
    if (timer) clearInterval(timer);
    store.close();
  });
  return app;
}
function assertMediaPath(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(`Folder must be inside the mounted media root (${root})`);
}
function hostMediaPath(config: Config, containerPath: string) {
  return config.mediaHostRoot
    ? path.join(
        config.mediaHostRoot,
        path.relative(config.mediaRoot, containerPath),
      )
    : undefined;
}

function mapQbitPreferences(values: Record<string, unknown>): QbitPreferences {
  const text = (key: string) => String(values[key] ?? ""),
    bool = (key: string) => Boolean(values[key]),
    number = (key: string, fallback = 0) => {
      const value = Number(values[key]);
      return Number.isFinite(value) ? value : fallback;
    };
  return {
    savePath: text("save_path"),
    tempPath: text("temp_path"),
    tempPathEnabled: bool("temp_path_enabled"),
    createSubfolder: bool("create_subfolder_enabled"),
    preallocateAll: bool("preallocate_all"),
    incompleteExtension: bool("incomplete_files_ext"),
    startPaused: bool("start_paused_enabled"),
    listenPort: number("listen_port", 6881),
    upnp: bool("upnp"),
    maxConnections: number("max_connec", 500),
    maxConnectionsPerTorrent: number("max_connec_per_torrent", 100),
    maxUploadsPerTorrent: number("max_uploads_per_torrent", 20),
    downloadLimit: number("dl_limit"),
    uploadLimit: number("up_limit"),
    alternativeDownloadLimit: number("alt_dl_limit"),
    alternativeUploadLimit: number("alt_up_limit"),
    queueingEnabled: bool("queueing_enabled"),
    maxActiveDownloads: number("max_active_downloads", 3),
    maxActiveUploads: number("max_active_uploads", 3),
    maxActiveTorrents: number("max_active_torrents", 5),
    dontCountSlowTorrents: bool("dont_count_slow_torrents"),
    dht: bool("dht"),
    pex: bool("pex"),
    lsd: bool("lsd"),
    encryption: number("encryption"),
    anonymousMode: bool("anonymous_mode"),
    maxRatioEnabled: bool("max_ratio_enabled"),
    maxRatio: number("max_ratio", 1),
    maxRatioAction: number("max_ratio_act"),
    maxSeedingTimeEnabled: bool("max_seeding_time_enabled"),
    maxSeedingTime: number("max_seeding_time"),
    schedulerEnabled: bool("scheduler_enabled"),
    scheduleFromHour: number("schedule_from_hour"),
    scheduleFromMinute: number("schedule_from_min"),
    scheduleToHour: number("schedule_to_hour"),
    scheduleToMinute: number("schedule_to_min"),
    schedulerDays: number("scheduler_days"),
    proxyType: number("proxy_type", -1),
    proxyAddress: text("proxy_ip"),
    proxyPort: number("proxy_port"),
    proxyPeerConnections: bool("proxy_peer_connections"),
    proxyAuthEnabled: bool("proxy_auth_enabled"),
    proxyUsername: text("proxy_username"),
    proxyPassword: "",
    proxyPasswordConfigured: text("proxy_password").length > 0,
    proxyTorrentsOnly: bool("proxy_torrents_only"),
  };
}

function toQbitPreferences(values: z.infer<typeof qbitPreferencesSchema>) {
  return {
    temp_path_enabled: values.tempPathEnabled,
    create_subfolder_enabled: values.createSubfolder,
    preallocate_all: values.preallocateAll,
    incomplete_files_ext: values.incompleteExtension,
    start_paused_enabled: values.startPaused,
    listen_port: values.listenPort,
    upnp: values.upnp,
    max_connec: values.maxConnections,
    max_connec_per_torrent: values.maxConnectionsPerTorrent,
    max_uploads_per_torrent: values.maxUploadsPerTorrent,
    dl_limit: values.downloadLimit,
    up_limit: values.uploadLimit,
    alt_dl_limit: values.alternativeDownloadLimit,
    alt_up_limit: values.alternativeUploadLimit,
    queueing_enabled: values.queueingEnabled,
    max_active_downloads: values.maxActiveDownloads,
    max_active_uploads: values.maxActiveUploads,
    max_active_torrents: values.maxActiveTorrents,
    dont_count_slow_torrents: values.dontCountSlowTorrents,
    dht: values.dht,
    pex: values.pex,
    lsd: values.lsd,
    encryption: values.encryption,
    anonymous_mode: values.anonymousMode,
    max_ratio_enabled: values.maxRatioEnabled,
    max_ratio: values.maxRatio,
    max_ratio_act: values.maxRatioAction,
    max_seeding_time_enabled: values.maxSeedingTimeEnabled,
    max_seeding_time: values.maxSeedingTime,
    scheduler_enabled: values.schedulerEnabled,
    schedule_from_hour: values.scheduleFromHour,
    schedule_from_min: values.scheduleFromMinute,
    schedule_to_hour: values.scheduleToHour,
    schedule_to_min: values.scheduleToMinute,
    scheduler_days: values.schedulerDays,
    proxy_type: values.proxyType,
    proxy_ip: values.proxyAddress,
    proxy_port: values.proxyPort,
    proxy_peer_connections: values.proxyPeerConnections,
    proxy_auth_enabled: values.proxyAuthEnabled,
    proxy_username: values.proxyUsername,
    ...(values.proxyPassword ? { proxy_password: values.proxyPassword } : {}),
    proxy_torrents_only: values.proxyTorrentsOnly,
  };
}

function sanitizeEngineLog(message: string) {
  return message
    .replace(/(password|passwd|token|authorization|cookie)=?\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[redacted]@");
}
