import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import type { Torrent } from "@harbor/contracts";

export class Store {
  readonly db: Database.Database;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, "harbor.db"));
    this.db.pragma("journal_mode = WAL"); this.db.pragma("foreign_keys = ON");
    this.db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tokens(id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);
      CREATE TABLE IF NOT EXISTS torrents(id TEXT PRIMARY KEY, info_hash TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, torrent_id TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL);`);
    this.db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (1, ?)").run(new Date().toISOString());
  }
  issueToken(label: string) { const token = `hbr_${randomBytes(24).toString("base64url")}`; this.db.prepare("INSERT INTO tokens VALUES (?, ?, ?, ?, NULL)").run(randomBytes(8).toString("hex"), hash(token), label, new Date().toISOString()); return token; }
  validToken(token: string) { return !!this.db.prepare("SELECT 1 FROM tokens WHERE token_hash=? AND revoked_at IS NULL").get(hash(token)); }
  list(): Torrent[] { return this.db.prepare("SELECT payload FROM torrents ORDER BY updated_at DESC").all().map((r: any) => JSON.parse(r.payload)); }
  get(id: string): Torrent | undefined { const row = this.db.prepare("SELECT payload FROM torrents WHERE id=?").get(id) as any; return row ? JSON.parse(row.payload) : undefined; }
  byHash(hashValue: string) { const row = this.db.prepare("SELECT payload FROM torrents WHERE info_hash=?").get(hashValue) as any; return row ? JSON.parse(row.payload) as Torrent : undefined; }
  setting(key: string) { return (this.db.prepare("SELECT value FROM settings WHERE key=?").get(key) as {value:string}|undefined)?.value; }
  setSetting(key: string, value: string) { this.db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,value); }
  save(torrent: Torrent) { this.db.prepare("INSERT INTO torrents VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at").run(torrent.id, torrent.infoHash, JSON.stringify(torrent), new Date().toISOString()); }
  remove(id: string) { this.db.prepare("DELETE FROM torrents WHERE id=?").run(id); this.audit("torrent.removed", id, {}); }
  audit(action: string, torrentId: string | null, detail: unknown) { this.db.prepare("INSERT INTO audit(action,torrent_id,detail,created_at) VALUES(?,?,?,?)").run(action, torrentId, JSON.stringify(detail), new Date().toISOString()); }
  close() { this.db.close(); }
}
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
