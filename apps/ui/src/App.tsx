import { useEffect, useMemo, useState } from "react";
import type {
  Category,
  HarborSettings,
  ServerStatus,
  Torrent,
} from "@harbor/contracts";
import {
  AlertTriangle,
  Anchor,
  CheckCircle2,
  Download,
  FolderCheck,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Upload,
  Wifi,
  X,
} from "lucide-react";
import { api, connection } from "./lib/api";
import { Pairing } from "./components/Pairing";
import { AddTorrent } from "./components/AddTorrent";

const fmtSpeed = (n: number) => (n ? `${(n / 1e6).toFixed(1)} MB/s` : "—");
const fmtSize = (n: number) => (n < 0 ? "—" : `${(n / 1e9).toFixed(1)} GB`);
const fmtEta = (n: number | null) =>
  n === null
    ? "Waiting"
    : n === 0
      ? "Done"
      : `${Math.floor(n / 60)}m ${n % 60}s`;

export function App() {
  const [paired, setPaired] = useState(!!connection.get()),
    [items, setItems] = useState<Torrent[]>([]),
    [status, setStatus] = useState<ServerStatus | null>(null),
    [adding, setAdding] = useState(false),
    [reviewing, setReviewing] = useState<Torrent | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [view, setView] = useState<"downloads" | "settings">("downloads"),
    [error, setError] = useState("");
  async function refresh() {
    try {
      const [t, s] = await Promise.all([api.list(), api.status()]);
      setItems(t);
      setStatus(s);
      setError(
        s.engineConnected === false
          ? s.engineError || "qBittorrent is disconnected"
          : s.storageReady === false
            ? `Storage needs attention: ${s.storageIssues?.join(", ")}`
            : "",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnected");
    }
  }
  useEffect(() => {
    if (!paired) return;
    refresh();
    const id = setInterval(refresh, 1200);
    return () => clearInterval(id);
  }, [paired]);
  const visible = useMemo(
    () =>
      items.filter(
        (t) =>
          (filter === "all" ||
            (filter === "active" &&
              ["queued", "downloading"].includes(t.status)) ||
            (filter === "review" && t.status === "review") ||
            (filter === "complete" &&
              ["organized", "completed"].includes(t.status))) &&
          t.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [items, filter, query],
  );
  if (!paired)
    return (
      <>
        <Pairing onPaired={() => setPaired(true)} />
      </>
    );
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="logo">
            <Anchor />
          </span>
          <strong>Harbor</strong>
        </div>
        <div className="header-server">
          <div>
            <span className={error ? "status-dot offline" : "status-dot"} />
            <strong>{connection.get()?.serverName}</strong>
          </div>
          <span>
            {error
              ? "Connection interrupted"
              : `${fmtSpeed(status?.downloadSpeed ?? 0)} down · ${fmtSpeed(status?.uploadSpeed ?? 0)} up`}
          </span>
        </div>
        <div className="header-actions">
          {view === "settings" && (
            <button
              className="quiet header-nav"
              onClick={() => setView("downloads")}
            >
              <Download /> Downloads
            </button>
          )}
          <button className="connection">
            <Wifi /> {error ? "Attention needed" : "Unraid connected"}
          </button>
          <button
            className={
              view === "settings" ? "icon-button active" : "icon-button"
            }
            title="Settings"
            onClick={() =>
              setView(view === "settings" ? "downloads" : "settings")
            }
          >
            <Settings />
          </button>
          <button className="primary" onClick={() => setAdding(true)}>
            <Plus /> Add torrent
          </button>
        </div>
      </header>
      <main className="content">
        {view === "settings" ? (
          <SettingsPage />
        ) : (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">YOUR SERVER</p>
                <h1>Downloads</h1>
              </div>
            </header>
            <section className="summary">
              <div>
                <small>ACTIVE</small>
                <strong>
                  {items.filter((x) => x.status === "downloading").length}
                </strong>
                <span>transfers</span>
              </div>
              <div>
                <small>DOWNLOADING</small>
                <strong>{fmtSpeed(status?.downloadSpeed ?? 0)}</strong>
                <Download />
              </div>
              <div>
                <small>UPLOADING</small>
                <strong>{fmtSpeed(status?.uploadSpeed ?? 0)}</strong>
                <Upload />
              </div>
              <div>
                <small>NEEDS REVIEW</small>
                <strong>
                  {items.filter((x) => x.status === "review").length}
                </strong>
                <AlertTriangle />
              </div>
            </section>
            <section className="toolbar">
              <div className="tabs">
                {[
                  ["all", "All"],
                  ["active", "Active"],
                  ["complete", "Completed"],
                  ["review", "Needs review"],
                ].map(([id, label]) => (
                  <button
                    className={filter === id ? "active" : ""}
                    onClick={() => setFilter(id!)}
                    key={id}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="tools">
                <label className="search">
                  <Search />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search downloads"
                  />
                </label>
                <button className="icon-button">
                  <SlidersHorizontal />
                </button>
              </div>
            </section>
            {error && (
              <div className="offline-banner">
                <AlertTriangle /> {error}. Harbor will reconnect automatically.
              </div>
            )}
            <section className="torrent-list">
              <div className="list-head">
                <span>NAME</span>
                <span>SIZE</span>
                <span>PROGRESS</span>
                <span>SPEED</span>
                <span>ETA</span>
                <span />
              </div>
              {visible.length ? (
                visible.map((t) => (
                  <TorrentRow
                    key={t.id}
                    torrent={t}
                    refresh={refresh}
                    review={() => setReviewing(t)}
                  />
                ))
              ) : (
                <Empty
                  add={() => setAdding(true)}
                  filtered={!!query || filter !== "all"}
                />
              )}
            </section>
          </>
        )}
      </main>
      {adding && <AddTorrent close={() => setAdding(false)} added={refresh} />}{" "}
      {reviewing && (
        <Review
          torrent={reviewing}
          close={() => setReviewing(null)}
          saved={() => {
            setReviewing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
function TorrentRow({
  torrent: t,
  refresh,
  review,
}: {
  torrent: Torrent;
  refresh: () => void;
  review: () => void;
}) {
  const [actionOpen, setActionOpen] = useState(false),
    [expanded, setExpanded] = useState(false);
  async function act(action: string) {
    setActionOpen(false);
    await api.action(t.id, action);
    refresh();
  }
  return (
    <>
      <article className="torrent-row">
        <div className="torrent-name" onClick={() => setExpanded(!expanded)}>
          <div className={`file-icon ${t.classification.category}`}>
            <Download />
          </div>
          <div>
            <strong>{t.name}</strong>
            <p>
              <span className="category">{t.classification.category}</span>
              <span
                title={t.organizedHostPath ?? t.organizedPath ?? t.destination}
              >
                {t.organizedPath
                  ? `organized at ${t.organizedHostPath ?? t.organizedPath}`
                  : `will move to ${t.destination}`}
              </span>
              <span>
                {t.seeds} seeds · {t.peers} peers
              </span>
              <span>
                {t.retention === "remove"
                  ? "clean staging after"
                  : t.retention === "seed"
                    ? "keep seeding"
                    : "retain staging"}
              </span>
            </p>
          </div>
        </div>
        <span>{fmtSize(t.size)}</span>
        <div className="progress">
          <div>
            <i style={{ width: `${Math.round(t.progress * 100)}%` }} />
          </div>
          <p>
            <b>{Math.round(t.progress * 100)}%</b>
            <span>
              {fmtSize(t.downloaded)} of {fmtSize(t.size)}
            </span>
          </p>
        </div>
        <div className="speed">
          <strong>{fmtSpeed(t.downloadSpeed)}</strong>
          <small>↑ {fmtSpeed(t.uploadSpeed)}</small>
        </div>
        <span className="eta">
          {t.status === "review" ? (
            <button className="review-link" onClick={review}>
              Review
            </button>
          ) : t.status === "organized" ? (
            <em className="complete">
              <CheckCircle2 /> Organized
            </em>
          ) : (
            fmtEta(t.etaSeconds)
          )}
        </span>
        <div className="row-actions">
          <button
            className="icon-button"
            title={t.status === "paused" ? "Resume" : "Pause"}
            onClick={() => act(t.status === "paused" ? "resume" : "pause")}
          >
            {t.status === "paused" ? <Play /> : <Pause />}
          </button>
          <button
            className="icon-button"
            onClick={() => setActionOpen(!actionOpen)}
          >
            <MoreHorizontal />
          </button>
          {actionOpen && (
            <div className="action-menu">
              {t.status === "organized" && (
                <button
                  onClick={async () => {
                    if (
                      confirm(
                        "Copy this torrent into the currently configured library again, verify it, then remove its staging data?",
                      )
                    ) {
                      await api.action(t.id, "reorganize");
                      setActionOpen(false);
                      refresh();
                    }
                  }}
                >
                  Re-organize &amp; clean staging
                </button>
              )}
              <button
                onClick={async () => {
                  await api.retention(t.id, "remove");
                  setActionOpen(false);
                  refresh();
                }}
              >
                Organize & clean staging
              </button>
              <button
                onClick={async () => {
                  await api.retention(t.id, "seed");
                  setActionOpen(false);
                  refresh();
                }}
              >
                Keep seeding
              </button>
              <button onClick={() => act("recheck")}>Recheck files</button>
              <button
                className="danger"
                onClick={async () => {
                  if (
                    confirm(
                      "Remove this torrent from Harbor? Downloaded data will be kept.",
                    )
                  ) {
                    await api.remove(t.id);
                    refresh();
                  }
                }}
              >
                Remove torrent
              </button>
            </div>
          )}
        </div>
      </article>
      {expanded && (
        <div className="file-details">
          {t.organizedPath && (
            <div className="organized-location">
              <FolderCheck />
              <span>
                <small>ORGANIZED LOCATION</small>
                <strong>{t.organizedHostPath ?? t.organizedPath}</strong>
                {t.organizedHostPath && (
                  <small>Container path: {t.organizedPath}</small>
                )}
              </span>
            </div>
          )}
          <header>
            <strong>Files</strong>
            <span>{t.files.length} items</span>
          </header>
          {t.files.map((file) => (
            <div key={file.id}>
              <span>{file.name}</span>
              <span>{fmtSize(file.size)}</span>
              <select
                value={file.priority}
                onChange={async (e) => {
                  await api.filePriority(
                    t.id,
                    [file.id],
                    Number(e.target.value),
                  );
                  refresh();
                }}
              >
                <option value="0">Skip</option>
                <option value="1">Normal</option>
                <option value="6">High</option>
                <option value="7">Maximum</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState<HarborSettings | null>(null),
    [folders, setFolders] = useState<string[]>([]),
    [token, setToken] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api.settings(), api.directories()])
      .then(([value, list]) => {
        setSettings(value);
        setFolders(list.directories);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Settings could not be loaded",
        ),
      );
  }, []);
  if (!settings)
    return (
      <>
        <header className="topbar">
          <div>
            <p className="eyebrow">HARBOR COMPANION</p>
            <h1>Settings</h1>
          </div>
        </header>
        <div className="settings-loading">
          {error || "Loading server folders…"}
        </div>
      </>
    );
  async function save() {
    setError("");
    setNotice("");
    try {
      if (!settings) throw new Error("Settings are still loading");
      const saved = await api.saveSettings({
        moviesDir: settings.moviesDir,
        tvDir: settings.tvDir,
        reviewDir: settings.reviewDir,
        metadataLanguage: settings.metadataLanguage,
        tmdbAccessToken: token || undefined,
      });
      setSettings(saved);
      setToken("");
      setNotice("Settings saved and all folders are writable.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settings could not be saved");
    }
  }
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">HARBOR COMPANION</p>
          <h1>Settings</h1>
        </div>
        <button className="primary" onClick={save}>
          <CheckCircle2 /> Save and verify
        </button>
      </header>
      <div className="settings-page">
        <section className="settings-section">
          <div>
            <h2>Media destinations</h2>
            <p>
              These are folders inside the media share mounted by the Unraid
              installer. Harbor verifies each path before accepting it.
            </p>
          </div>
          <div className="settings-form">
            <PathField
              label="Movies"
              value={settings.moviesDir}
              folders={folders}
              onChange={(moviesDir) => setSettings({ ...settings, moviesDir })}
            />
            <PathField
              label="TV shows"
              value={settings.tvDir}
              folders={folders}
              onChange={(tvDir) => setSettings({ ...settings, tvDir })}
            />
            <PathField
              label="Needs review"
              value={settings.reviewDir}
              folders={folders}
              onChange={(reviewDir) => setSettings({ ...settings, reviewDir })}
            />
            <div className="mount-note">
              <FolderCheck />
              <span>
                <strong>
                  {settings.mediaHostRoot ?? "Unraid host path unavailable"}
                </strong>{" "}
                is mounted inside Harbor as{" "}
                <strong>{settings.mediaRoot}</strong>
              </span>
            </div>
          </div>
        </section>
        <section className="settings-section">
          <div>
            <h2>Content identification</h2>
            <p>
              Local filename rules run first. TMDB then confirms movie and
              television titles. Ambiguous results stay in Needs Review.
            </p>
          </div>
          <div className="settings-form">
            <label>
              TMDB API Read Access Token
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  settings.tmdbConfigured
                    ? "Configured — enter a token only to replace it"
                    : "Paste your TMDB read token"
                }
              />
              <small>
                The token is sent only to your Harbor server and is never
                returned by the API.
              </small>
            </label>
            <label>
              Metadata language
              <input
                value={settings.metadataLanguage}
                onChange={(e) =>
                  setSettings({ ...settings, metadataLanguage: e.target.value })
                }
                placeholder="en-US"
              />
            </label>
            <div
              className={
                settings.tmdbConfigured
                  ? "provider-state ready"
                  : "provider-state"
              }
            >
              <span />
              <strong>
                {settings.tmdbConfigured
                  ? "TMDB matching enabled"
                  : "Local matching only"}
              </strong>
            </div>
          </div>
        </section>
        {notice && (
          <div className="settings-success">
            <CheckCircle2 />
            {notice}
          </div>
        )}
        {error && (
          <div className="offline-banner">
            <AlertTriangle />
            {error}
          </div>
        )}
      </div>
    </>
  );
}
function PathField({
  label,
  value,
  folders,
  onChange,
}: {
  label: string;
  value: string;
  folders: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={value}>{value}</option>
        {folders
          .filter((folder) => folder !== value)
          .map((folder) => (
            <option key={folder}>{folder}</option>
          ))}
      </select>
    </label>
  );
}
function Review({
  torrent,
  close,
  saved,
}: {
  torrent: Torrent;
  close: () => void;
  saved: () => void;
}) {
  const [category, setCategory] = useState(torrent.classification.category),
    [title, setTitle] = useState(torrent.classification.title),
    [season, setSeason] = useState(
      torrent.classification.season?.toString() ?? "",
    ),
    [episode, setEpisode] = useState(
      torrent.classification.episode?.toString() ?? "",
    ),
    [error, setError] = useState("");
  async function save() {
    try {
      await api.correct(torrent.id, {
        category,
        title,
        season: season ? Number(season) : undefined,
        episode: episode ? Number(episode) : undefined,
      });
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Correction failed");
    }
  }
  return (
    <div className="scrim">
      <section className="sheet review-sheet">
        <header>
          <div>
            <p className="eyebrow">NEEDS REVIEW</p>
            <h2>Choose where this belongs</h2>
          </div>
          <button className="icon-button" onClick={close}>
            <X />
          </button>
        </header>
        <p className="lede">
          Harbor was only {Math.round(torrent.classification.confidence * 100)}%
          confident because {torrent.classification.reasons.join(", ")}. Nothing
          will be organized until you confirm.
        </p>
        <div className="field-grid">
          <label>
            Category
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as Exclude<Category, "auto">)
              }
            >
              {[
                "movie",
                "tv",
                "game",
                "music",
                "software",
                "book",
                "general",
                "review",
              ].map((x) => (
                <option value={x} key={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {category === "tv" && (
            <>
              <label>
                Season
                <input
                  type="number"
                  min="0"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                />
              </label>
              <label>
                Episode (blank for pack)
                <input
                  type="number"
                  min="0"
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
        <div className="safe-note">
          <FolderCheck />
          <span>
            Destination: <strong>{torrent.destination}</strong>. The corrected
            category mapping is applied when you confirm.
          </span>
        </div>
        {error && <div className="error">{error}</div>}
        <footer>
          <button className="quiet" onClick={close}>
            Leave in review
          </button>
          <button className="primary" onClick={save}>
            Confirm and organize
          </button>
        </footer>
      </section>
    </div>
  );
}
function Empty({ add, filtered }: { add: () => void; filtered: boolean }) {
  return (
    <div className="empty">
      <div className="empty-rings">
        <Anchor />
      </div>
      <h2>{filtered ? "Nothing matches" : "Your harbor is calm"}</h2>
      <p>
        {filtered
          ? "Try changing the search or filter."
          : "Send a torrent to Unraid and it will appear here with live progress."}
      </p>
      {!filtered && (
        <button className="primary" onClick={add}>
          <Plus /> Add your first torrent
        </button>
      )}
    </div>
  );
}
