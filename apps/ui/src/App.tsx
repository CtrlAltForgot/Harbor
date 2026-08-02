import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  Category,
  HarborSettings,
  QbitEngineInfo,
  QbitPreferences,
  ServerStatus,
  Torrent,
} from "@harbor/contracts";
import {
  AlertTriangle,
  Anchor,
  ArrowUpDown,
  CheckCircle2,
  Clock3,
  Download,
  FolderCheck,
  FolderSync,
  KeyRound,
  Gauge,
  ListOrdered,
  LogOut,
  MoreHorizontal,
  Network,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  Wifi,
  X,
} from "lucide-react";
import { api, connection } from "./lib/api";
import { Pairing } from "./components/Pairing";
import { AddTorrent } from "./components/AddTorrent";
import { sortTorrents, type TorrentSort } from "./lib/sort";
import { floatingMenuPosition, nearestRowScroll } from "./lib/layout";
import { displayedProgress, isSortingStatus, torrentMatchesFilter, type TorrentFilter } from "./lib/filter";
import { formatEta, formatSpeed, overallDownloadEta, transferCounts } from "./lib/format";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const fmtSize = (n: number) => (n < 0 ? "—" : `${(n / 1e9).toFixed(1)} GB`);

export function App() {
  const [paired, setPaired] = useState(!!connection.get()),
    [items, setItems] = useState<Torrent[]>([]),
    [status, setStatus] = useState<ServerStatus | null>(null),
    [adding, setAdding] = useState(false),
    [reviewing, setReviewing] = useState<Torrent | null>(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState<TorrentSort>(() => {
      const saved = localStorage.getItem("harbor.torrent-sort");
      return (saved as TorrentSort) || "added-desc";
    }),
    [view, setView] = useState<"downloads" | "settings">("downloads"),
    [error, setError] = useState(""),
    [dropActive, setDropActive] = useState(false),
    [dropError, setDropError] = useState(""),
    [droppedFile, setDroppedFile] = useState<{
      name: string;
      base64: string;
    } | null>(null);
  const previousItems = useRef<Map<string, Torrent>>(new Map()),
    hasSnapshot = useRef(false),
    torrentList = useRef<HTMLElement>(null);
  async function refresh() {
    try {
      const [t, s] = await Promise.all([api.list(), api.status()]);
      if (hasSnapshot.current)
        for (const torrent of t) {
          const previous = previousItems.current.get(torrent.id);
          if (!previous || previous.status === torrent.status) continue;
          if (torrent.status === "organized")
            void desktopNotification(
              "Torrent organized",
              `${torrent.name} was moved to ${torrent.organizedHostPath ?? torrent.organizedPath ?? torrent.destination}`,
            );
          else if (torrent.status === "review")
            void desktopNotification(
              "Torrent needs review",
              `${torrent.name} finished downloading but needs classification attention.`,
            );
          else if (torrent.status === "completed")
            void desktopNotification(
              "Torrent download complete",
              `${torrent.name} finished downloading and Harbor is processing it.`,
            );
        }
      previousItems.current = new Map(t.map((torrent) => [torrent.id, torrent]));
      hasSnapshot.current = true;
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
  useEffect(() => {
    if (view !== "downloads") return;
    const list = torrentList.current;
    if (!list) return;
    let timer = 0;
    const alignRows = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const listTop = list.getBoundingClientRect().top;
        const headerHeight = list.querySelector<HTMLElement>(".list-head")?.offsetHeight ?? 0;
        const starts = Array.from(list.querySelectorAll<HTMLElement>(".torrent-row")).map(
          (row) => row.getBoundingClientRect().top - listTop + list.scrollTop - headerHeight,
        );
        const target = Math.max(0, nearestRowScroll(list.scrollTop, starts));
        if (Math.abs(target - list.scrollTop) > 1)
          list.scrollTo({ top: target, behavior: "smooth" });
      }, 120);
    };
    list.addEventListener("scroll", alignRows, { passive: true });
    window.addEventListener("resize", alignRows);
    return () => {
      window.clearTimeout(timer);
      list.removeEventListener("scroll", alignRows);
      window.removeEventListener("resize", alignRows);
    };
  }, [view]);
  useEffect(() => {
    if (!window.__TAURI__) return;
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent(async (event) => {
        if (
          event.payload.type === "enter" ||
          event.payload.type === "over"
        ) {
          setDropActive(true);
          return;
        }
        if (event.payload.type === "leave") {
          setDropActive(false);
          return;
        }
        if (event.payload.type !== "drop") return;
        setDropActive(false);
        try {
          if (event.payload.paths.length !== 1)
            throw new Error("Drop one .torrent file at a time");
          const dropped = await window.__TAURI__!.core.invoke<{
            name: string;
            bytes: number[];
          }>("read_torrent_file", { path: event.payload.paths[0] });
          setDroppedFile({
            name: dropped.name,
            base64: bytesToBase64(dropped.bytes),
          });
          setDropError("");
          setAdding(true);
        } catch (error) {
          setDropError(
            error instanceof Error ? error.message : String(error),
          );
        }
      })
      .then((stop) => (unlisten = stop))
      .catch(() => {});
    return () => unlisten?.();
  }, []);
  const visible = useMemo(
    () =>
      sortTorrents(
        items.filter(
          (t) =>
            torrentMatchesFilter(filter as TorrentFilter, t.status) &&
            t.name.toLowerCase().includes(query.toLowerCase()),
        ),
        sort,
      ),
    [items, filter, query, sort],
  );
  const counts = transferCounts(items);
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
              : `${formatSpeed(status?.downloadSpeed ?? 0)} down · ${formatSpeed(status?.uploadSpeed ?? 0)} up`}
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
          <button className="connection" onClick={() => setView("settings")}>
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
      <main className={view === "downloads" ? "content downloads-content" : "content"}>
        {view === "settings" ? (
          <SettingsPage connectionError={error} />
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
                <small>QUEUED</small>
                <strong>{counts.queued}</strong>
                <span>transfers</span>
              </div>
              <div>
                <small>ACTIVE</small>
                <strong>{counts.active}</strong>
                <span>transfers</span>
              </div>
              <div>
                <small>DOWNLOADING</small>
                <strong>{formatSpeed(status?.downloadSpeed ?? 0)}</strong>
                <Download />
              </div>
              <div>
                <small>UPLOADING</small>
                <strong>{formatSpeed(status?.uploadSpeed ?? 0)}</strong>
                <Upload />
              </div>
              <div>
                <small>ALL DOWNLOADS ETA</small>
                <strong>{overallDownloadEta(items)}</strong>
                <Clock3 />
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
                  ["sorting", "Sorting"],
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
                <label className="sort-control" title="Sort torrents">
                  <ArrowUpDown />
                  <select
                    value={sort}
                    onChange={(event) => {
                      const next = event.target.value as TorrentSort;
                      setSort(next);
                      localStorage.setItem("harbor.torrent-sort", next);
                    }}
                  >
                    <option value="added-desc">Newest added</option>
                    <option value="added-asc">Oldest added</option>
                    <option value="name-asc">Name A–Z</option>
                    <option value="name-desc">Name Z–A</option>
                    <option value="progress-desc">Progress</option>
                    <option value="status-asc">Status</option>
                  </select>
                </label>
                <label className="search">
                  <Search />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search downloads"
                  />
                </label>
              </div>
            </section>
            {error && (
              <div className="offline-banner">
                <AlertTriangle />
                <span>{error}. Harbor will reconnect automatically.</span>
                <button onClick={() => setView("settings")}>
                  Update connection
                </button>
              </div>
            )}
            <section className="torrent-list" ref={torrentList}>
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
      {dropActive && (
        <div className="drop-overlay">
          <Download />
          <strong>Drop .torrent file to add it</strong>
          <span>You will confirm its destination before Harbor starts it.</span>
        </div>
      )}
      {dropError && (
        <button className="drop-error" onClick={() => setDropError("")}>
          <AlertTriangle /> {dropError}
        </button>
      )}
      {adding && (
        <AddTorrent
          initialFile={droppedFile}
          close={() => {
            setAdding(false);
            setDroppedFile(null);
          }}
          added={refresh}
        />
      )}{" "}
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

function bytesToBase64(bytes: number[]) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.slice(offset, offset + 8192));
  return btoa(binary);
}

async function desktopNotification(title: string, body: string) {
  if (
    !window.__TAURI__ ||
    localStorage.getItem("harbor.notifications") === "false"
  )
    return;
  try {
    let allowed = await isPermissionGranted();
    if (!allowed) allowed = (await requestPermission()) === "granted";
    if (allowed) sendNotification({ title, body });
  } catch {
    // Transfer monitoring must continue if the desktop notification service is
    // unavailable or permission is denied.
  }
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
    [expanded, setExpanded] = useState(false),
    [removeOpen, setRemoveOpen] = useState(false),
    [actionError, setActionError] = useState(""),
    [downloadLimit, setDownloadLimit] = useState(0),
    [uploadLimit, setUploadLimit] = useState(0),
    [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, maxHeight: 0 });
  const sorting = isSortingStatus(t.status),
    activelySorting = t.status === "processing",
    shownProgress = displayedProgress(t.status, t.progress, t.organization?.progress);
  const actionButton = useRef<HTMLButtonElement>(null);
  function positionActionMenu() {
    const anchor = actionButton.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setMenuPosition(floatingMenuPosition(rect, window.innerWidth, window.innerHeight));
  }
  useEffect(() => {
    if (!actionOpen) return;
    positionActionMenu();
    const update = () => positionActionMenu();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [actionOpen]);
  async function act(action: string) {
    setActionOpen(false);
    setActionError("");
    try {
      await api.action(t.id, action);
      refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Torrent control failed",
      );
    }
  }
  return (
    <>
      <article className={`torrent-row${sorting ? " processing" : ""}`}>
        <div className="torrent-name" onClick={() => setExpanded(!expanded)}>
          <div className={`file-icon ${sorting ? "sorting" : t.classification.category}`}>
            {sorting ? <FolderSync /> : <Download />}
          </div>
          <div>
            <strong>{t.name}</strong>
            <p>
              <span className="category">{t.classification.category === "tv" ? "TV" : t.classification.category}</span>
              <span
                title={t.organizedHostPath ?? t.organizedPath ?? t.destination}
              >
                {t.organizedPath
                  ? `Moved to → ${t.organizedHostPath ?? t.organizedPath}`
                  : sorting
                    ? `Moving to → ${t.destination}`
                    : `Moving to → ${t.destination} on completion`}
              </span>
              <span>
                {t.seeds} seeds · {t.peers} peers
              </span>
            </p>
          </div>
        </div>
        <span>{fmtSize(t.size)}</span>
        <div className="progress">
          <div>
            <i style={{ width: `${Math.round(shownProgress * 100)}%` }} />
          </div>
          <p>
            <b>{Math.round(shownProgress * 100)}%</b>
            <span>
              {activelySorting && t.organization
                ? `${fmtSize(t.organization.bytesProcessed)} of ${fmtSize(t.organization.totalBytes)}`
                : `${fmtSize(t.downloaded)} of ${fmtSize(t.size)}`}
            </span>
          </p>
        </div>
        <div className="speed">
          <strong>{formatSpeed(t.downloadSpeed)}</strong>
          <small>↑ {formatSpeed(t.uploadSpeed)}</small>
        </div>
        <span className="eta">
          {sorting ? (
            <em className="sorting-state">
              <FolderSync /> Sorting · {activelySorting ? (t.organization?.phase ?? "preparing") : "waiting"}
            </em>
          ) : t.status === "review" ? (
            <button className="review-link" onClick={review}>
              Review
            </button>
          ) : t.status === "organized" ? (
            <em className="complete">
              <CheckCircle2 /> Organized
            </em>
          ) : t.status === "failed" ? (
            <em className="failed-state" title={t.error}>
              <AlertTriangle /> Attention
            </em>
          ) : (
            formatEta(t.etaSeconds)
          )}
        </span>
        <div className="row-actions">
          {["queued", "downloading", "paused"].includes(t.status) && (
            <button
              className="icon-button"
              title={t.status === "paused" ? "Resume" : "Pause"}
              onClick={() => act(t.status === "paused" ? "resume" : "pause")}
            >
              {t.status === "paused" ? <Play /> : <Pause />}
            </button>
          )}
          <>
          <button
            ref={actionButton}
            className="icon-button"
            disabled={sorting}
            title={sorting ? "Controls are available after sorting finishes" : "Torrent actions"}
            onClick={() => {
              positionActionMenu();
              setActionOpen(!actionOpen);
            }}
          >
            <MoreHorizontal />
          </button>
          {actionOpen && createPortal(
            <div className="action-menu action-menu-portal" style={{ top: menuPosition.top, left: menuPosition.left, maxHeight: menuPosition.maxHeight }}>
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
              {t.status !== "failed" && <button
                onClick={async () => {
                  await api.retention(t.id, "remove");
                  setActionOpen(false);
                  refresh();
                }}
              >
                Organize & clean staging
              </button>}
              {t.status !== "failed" && <button
                onClick={async () => {
                  await api.retention(t.id, "seed");
                  setActionOpen(false);
                  refresh();
                }}
              >
                Keep seeding
              </button>}
              {t.status !== "failed" && <button onClick={() => act("recheck")}>Recheck files</button>}
              {t.status !== "failed" && <button onClick={() => act("reannounce")}>Reannounce to trackers</button>}
              {t.status !== "failed" && <button onClick={() => act("queue-top")}>Move to top of queue</button>}
              {t.status !== "failed" && <button onClick={() => act("queue-up")}>Move up in queue</button>}
              {t.status !== "failed" && <button onClick={() => act("queue-down")}>Move down in queue</button>}
              {t.status !== "failed" && <button onClick={() => act("queue-bottom")}>Move to bottom of queue</button>}
              <button
                className="danger"
                onClick={() => {
                  setActionOpen(false);
                  setRemoveOpen(true);
                }}
              >
                Remove torrent
              </button>
            </div>,
            document.body,
          )}
            </>
        </div>
      </article>
      {actionError && <div className="row-error">{actionError}</div>}
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
          <div className="torrent-limits">
            <label>Download limit <span><input type="number" min="0" value={downloadLimit} onChange={(event) => setDownloadLimit(Number(event.target.value))} /> KiB/s</span></label>
            <label>Upload limit <span><input type="number" min="0" value={uploadLimit} onChange={(event) => setUploadLimit(Number(event.target.value))} /> KiB/s</span></label>
            <button className="quiet" onClick={async () => { try { await api.limits(t.id, downloadLimit * 1024, uploadLimit * 1024); setActionError(""); } catch (error) { setActionError(error instanceof Error ? error.message : "Limits were rejected"); } }}>Apply limits</button>
            <small>0 means unlimited.</small>
          </div>
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
      {removeOpen && (
        <RemoveTorrent
          torrent={t}
          close={() => setRemoveOpen(false)}
          removed={() => {
            setRemoveOpen(false);
            refresh();
          }}
        />
      )}
    </>
  );
}

function RemoveTorrent({
  torrent,
  close,
  removed,
}: {
  torrent: Torrent;
  close: () => void;
  removed: () => void;
}) {
  const [deleteFiles, setDeleteFiles] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api.remove(torrent.id, deleteFiles);
      removed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Torrent could not be removed");
      setBusy(false);
    }
  }
  return (
    <div
      className="scrim"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section className="confirm-card">
        <header>
          <div>
            <p className="eyebrow">REMOVE TORRENT</p>
            <h2>{torrent.name}</h2>
          </div>
          <button className="icon-button" onClick={close}>
            <X />
          </button>
        </header>
        <p>
          The torrent will be removed from qBittorrent and deleted from Harbor.
          You can add the same torrent again later.
        </p>
        <label className="delete-files-choice">
          <input
            type="checkbox"
            checked={deleteFiles}
            onChange={(event) => setDeleteFiles(event.target.checked)}
          />
          <span>
            <strong>Also delete original downloaded files</strong>
            <small>
              Only Harbor's incomplete-download path may be deleted. An
              organized library copy is never deleted.
            </small>
          </span>
        </label>
        {deleteFiles && (
          <div className="destructive-warning">
            <AlertTriangle /> This permanently deletes the original staging
            files after qBittorrent confirms removal.
          </div>
        )}
        {error && (
          <div className="error">
            <AlertTriangle /> {error}
          </div>
        )}
        <footer>
          <button className="quiet" onClick={close}>
            Cancel
          </button>
          <button className="danger-action" disabled={busy} onClick={remove}>
            {busy
              ? "Removing…"
              : deleteFiles
                ? "Remove and delete files"
                : "Remove torrent"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function SettingsPage({ connectionError }: { connectionError: string }) {
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
        {settings && (
          <button className="primary" onClick={save}>
            <CheckCircle2 /> Save and verify
          </button>
        )}
      </header>
      <div className="settings-page">
        <ConnectionSettings connectionError={connectionError} />
        <DesktopBehavior />
        <EngineSettings />
        {!settings && (
          <div className="settings-loading">
            {error || "Loading server folders…"}
          </div>
        )}
        {settings && (
          <>
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
          </>
        )}
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

function ConnectionSettings({ connectionError }: { connectionError: string }) {
  const saved = connection.get();
  const [url, setUrl] = useState(saved?.baseUrl ?? "http://localhost:7331"),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function reconnect() {
    setBusy(true);
    setMessage("");
    try {
      if (!code.trim()) throw new Error("Enter the current pairing code from Unraid");
      await api.pair(url, code.trim());
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not pair with Harbor");
      setBusy(false);
    }
  }
  function forget() {
    connection.clear();
    window.location.reload();
  }
  return (
    <section className="settings-section connection-settings">
      <div>
        <h2>Connection & pairing</h2>
        <p>
          Replace the saved connection whenever the Unraid address or pairing
          code changes. Harbor never displays the saved access token.
        </p>
      </div>
      <div className="settings-form">
        <label>
          Server address
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://tower.local:7331"
          />
        </label>
        <label>
          Current pairing code
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reconnect()}
            placeholder="Paste the current code from Unraid"
          />
          <small>This replaces the rejected credential stored on this PC.</small>
        </label>
        {(message || connectionError) && (
          <div className="connection-warning">
            <AlertTriangle /> {message || connectionError}
          </div>
        )}
        <div className="connection-actions">
          <button className="primary" onClick={reconnect} disabled={busy}>
            <KeyRound /> {busy ? "Pairing…" : "Pair and reconnect"}
          </button>
          <button className="quiet danger-button" onClick={forget}>
            <LogOut /> Forget server
          </button>
        </div>
      </div>
    </section>
  );
}

function DesktopBehavior() {
  const [notifications, setNotifications] = useState(
    localStorage.getItem("harbor.notifications") !== "false",
  );
  return (
    <section className="settings-section desktop-behavior">
      <div>
        <h2>Desktop behavior</h2>
        <p>
          Harbor Desktop is a remote control. Downloads, classification, and
          organization run on Unraid, so the desktop app does not need to be
          open. Only the Harbor server and qBittorrent containers need to stay
          running.
        </p>
      </div>
      <div className="settings-form">
        <div className="behavior-note">
          <Download />
          <span>
            <strong>Closing Harbor minimizes it to the system tray</strong>
            <small>
              Use the tray menu to reopen Harbor or choose Quit Harbor to stop
              the desktop controller completely.
            </small>
          </span>
        </div>
        <label className="notification-choice">
          <input
            type="checkbox"
            checked={notifications}
            onChange={(event) => {
              setNotifications(event.target.checked);
              localStorage.setItem(
                "harbor.notifications",
                String(event.target.checked),
              );
            }}
          />
          <span>
            <strong>Desktop notifications</strong>
            <small>
              Notify when a torrent is organized or needs classification
              attention while Harbor is running in the tray.
            </small>
          </span>
        </label>
      </div>
    </section>
  );
}

type EngineSection =
  | "downloads"
  | "connection"
  | "speed"
  | "queueing"
  | "bittorrent"
  | "seeding"
  | "scheduler"
  | "proxy"
  | "diagnostics";

function EngineSettings() {
  const [preferences, setPreferences] = useState<QbitPreferences | null>(null),
    [section, setSection] = useState<EngineSection>("downloads"),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [engineInfo, setEngineInfo] = useState<QbitEngineInfo | null>(null);
  useEffect(() => {
    api.enginePreferences().then(setPreferences).catch((error) =>
      setError(
        error instanceof Error
          ? error.message
          : "qBittorrent settings could not be loaded",
      ),
    );
  }, []);
  async function save() {
    if (!preferences) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setPreferences(await api.saveEnginePreferences(preferences));
      setNotice("qBittorrent confirmed these settings.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Settings were rejected");
    } finally {
      setBusy(false);
    }
  }
  const update = <K extends keyof QbitPreferences>(
    key: K,
    value: QbitPreferences[K],
  ) => preferences && setPreferences({ ...preferences, [key]: value });
  async function loadEngineInfo() {
    setError("");
    try { setEngineInfo(await api.engineInfo()); }
    catch (error) { setError(error instanceof Error ? error.message : "Diagnostics could not be loaded"); }
  }
  useEffect(() => { if (section === "diagnostics") void loadEngineInfo(); }, [section]);
  const sections: Array<[EngineSection, string, typeof Download]> = [
    ["downloads", "Downloads", Download],
    ["connection", "Connection", Network],
    ["speed", "Speed", Gauge],
    ["queueing", "Queueing", ListOrdered],
    ["bittorrent", "BitTorrent", ShieldCheck],
    ["seeding", "Seeding", Upload],
    ["scheduler", "Scheduler", Gauge],
    ["proxy", "Proxy", Network],
    ["diagnostics", "Diagnostics", AlertTriangle],
  ];
  return (
    <section className="engine-settings">
      <header>
        <div>
          <p className="eyebrow">TORRENT ENGINE</p>
          <h2>qBittorrent settings</h2>
          <p>
            Harbor writes these settings directly to the dedicated Unraid
            qBittorrent service and reads them back for confirmation.
          </p>
        </div>
        <button className="primary" disabled={!preferences || busy} onClick={save}>
          <CheckCircle2 /> {busy ? "Saving…" : "Save qBittorrent settings"}
        </button>
      </header>
      <div className="engine-settings-body">
        <nav aria-label="qBittorrent settings categories">
          {sections.map(([id, label, Icon]) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              onClick={() => setSection(id)}
            >
              <Icon /> {label}
            </button>
          ))}
        </nav>
        <div className="engine-settings-panel">
          {!preferences ? (
            <div className="settings-loading">{error || "Loading qBittorrent settings…"}</div>
          ) : section === "downloads" ? (
            <>
              <h3>Downloads</h3>
              <ReadOnlySetting label="Harbor download path" value={preferences.savePath} />
              <ReadOnlySetting label="Incomplete path" value={preferences.tempPath} />
              <BooleanSetting label="Use incomplete-download folder" value={preferences.tempPathEnabled} onChange={(value) => update("tempPathEnabled", value)} />
              <BooleanSetting label="Create a subfolder for multi-file torrents" value={preferences.createSubfolder} onChange={(value) => update("createSubfolder", value)} />
              <BooleanSetting label="Pre-allocate disk space" value={preferences.preallocateAll} onChange={(value) => update("preallocateAll", value)} />
              <BooleanSetting label="Append .!qB to incomplete files" value={preferences.incompleteExtension} onChange={(value) => update("incompleteExtension", value)} />
              <BooleanSetting label="Add new torrents paused" value={preferences.startPaused} onChange={(value) => update("startPaused", value)} />
            </>
          ) : section === "connection" ? (
            <>
              <h3>Connection</h3>
              <NumberSetting label="Incoming connections port" value={preferences.listenPort} min={1} max={65535} onChange={(value) => update("listenPort", value)} />
              <BooleanSetting label="Use UPnP / NAT-PMP port forwarding" value={preferences.upnp} onChange={(value) => update("upnp", value)} />
              <NumberSetting label="Global maximum connections (-1 unlimited)" value={preferences.maxConnections} min={-1} onChange={(value) => update("maxConnections", value)} />
              <NumberSetting label="Maximum connections per torrent" value={preferences.maxConnectionsPerTorrent} min={-1} onChange={(value) => update("maxConnectionsPerTorrent", value)} />
              <NumberSetting label="Upload slots per torrent" value={preferences.maxUploadsPerTorrent} min={-1} onChange={(value) => update("maxUploadsPerTorrent", value)} />
            </>
          ) : section === "speed" ? (
            <>
              <h3>Speed limits</h3>
              <SpeedSetting label="Global download limit" value={preferences.downloadLimit} onChange={(value) => update("downloadLimit", value)} />
              <SpeedSetting label="Global upload limit" value={preferences.uploadLimit} onChange={(value) => update("uploadLimit", value)} />
              <SpeedSetting label="Alternative download limit" value={preferences.alternativeDownloadLimit} onChange={(value) => update("alternativeDownloadLimit", value)} />
              <SpeedSetting label="Alternative upload limit" value={preferences.alternativeUploadLimit} onChange={(value) => update("alternativeUploadLimit", value)} />
            </>
          ) : section === "queueing" ? (
            <>
              <h3>Queueing</h3>
              <BooleanSetting label="Enable torrent queueing" value={preferences.queueingEnabled} onChange={(value) => update("queueingEnabled", value)} />
              <NumberSetting label="Maximum active downloads" value={preferences.maxActiveDownloads} min={-1} onChange={(value) => update("maxActiveDownloads", value)} />
              <NumberSetting label="Maximum active uploads" value={preferences.maxActiveUploads} min={-1} onChange={(value) => update("maxActiveUploads", value)} />
              <NumberSetting label="Maximum active torrents" value={preferences.maxActiveTorrents} min={-1} onChange={(value) => update("maxActiveTorrents", value)} />
              <BooleanSetting label="Do not count slow torrents" value={preferences.dontCountSlowTorrents} onChange={(value) => update("dontCountSlowTorrents", value)} />
            </>
          ) : section === "bittorrent" ? (
            <>
              <h3>BitTorrent privacy and discovery</h3>
              <BooleanSetting label="Enable DHT" value={preferences.dht} onChange={(value) => update("dht", value)} />
              <BooleanSetting label="Enable Peer Exchange (PeX)" value={preferences.pex} onChange={(value) => update("pex", value)} />
              <BooleanSetting label="Enable Local Peer Discovery" value={preferences.lsd} onChange={(value) => update("lsd", value)} />
              <label className="engine-field">Encryption mode<select value={preferences.encryption} onChange={(event) => update("encryption", Number(event.target.value))}><option value={0}>Prefer encryption</option><option value={1}>Require encryption</option><option value={2}>Allow unencrypted only</option></select></label>
              <BooleanSetting label="Anonymous mode" value={preferences.anonymousMode} onChange={(value) => update("anonymousMode", value)} />
            </>
          ) : section === "seeding" ? (
            <>
              <h3>Seeding limits</h3>
              <BooleanSetting label="Stop after reaching a share ratio" value={preferences.maxRatioEnabled} onChange={(value) => update("maxRatioEnabled", value)} />
              <NumberSetting label="Maximum share ratio" value={preferences.maxRatio} min={0} onChange={(value) => update("maxRatio", value)} />
              <BooleanSetting label="Stop after a set seeding time" value={preferences.maxSeedingTimeEnabled} onChange={(value) => update("maxSeedingTimeEnabled", value)} />
              <NumberSetting label="Maximum seeding time (minutes)" value={preferences.maxSeedingTime} min={0} onChange={(value) => update("maxSeedingTime", value)} />
              <label className="engine-field">When a limit is reached<select value={preferences.maxRatioAction} onChange={(event) => update("maxRatioAction", Number(event.target.value))}><option value={0}>Pause the torrent</option><option value={1}>Remove the torrent (keep files)</option></select><small>Harbor never deletes organized media through this setting.</small></label>
            </>
          ) : section === "scheduler" ? (
            <>
              <h3>Alternative speed schedule</h3>
              <BooleanSetting label="Automatically use alternative speed limits" value={preferences.schedulerEnabled} onChange={(value) => update("schedulerEnabled", value)} />
              <div className="engine-field-row"><NumberSetting label="Start hour" value={preferences.scheduleFromHour} min={0} max={23} onChange={(value) => update("scheduleFromHour", value)} /><NumberSetting label="Start minute" value={preferences.scheduleFromMinute} min={0} max={59} onChange={(value) => update("scheduleFromMinute", value)} /></div>
              <div className="engine-field-row"><NumberSetting label="End hour" value={preferences.scheduleToHour} min={0} max={23} onChange={(value) => update("scheduleToHour", value)} /><NumberSetting label="End minute" value={preferences.scheduleToMinute} min={0} max={59} onChange={(value) => update("scheduleToMinute", value)} /></div>
              <label className="engine-field">Active days<select value={preferences.schedulerDays} onChange={(event) => update("schedulerDays", Number(event.target.value))}><option value={0}>Every day</option><option value={1}>Weekdays</option><option value={2}>Weekends</option><option value={3}>Monday</option><option value={4}>Tuesday</option><option value={5}>Wednesday</option><option value={6}>Thursday</option><option value={7}>Friday</option><option value={8}>Saturday</option><option value={9}>Sunday</option></select></label>
            </>
          ) : section === "proxy" ? (
            <>
              <h3>Proxy</h3>
              <label className="engine-field">Proxy type<select value={preferences.proxyType} onChange={(event) => update("proxyType", Number(event.target.value))}><option value={-1}>Disabled</option><option value={1}>HTTP</option><option value={2}>SOCKS5</option><option value={3}>HTTP with authentication</option><option value={4}>SOCKS5 with authentication</option><option value={5}>SOCKS4</option></select></label>
              <TextSetting label="Host or IP address" value={preferences.proxyAddress} onChange={(value) => update("proxyAddress", value)} />
              <NumberSetting label="Port" value={preferences.proxyPort} min={0} max={65535} onChange={(value) => update("proxyPort", value)} />
              <BooleanSetting label="Use proxy for peer connections" value={preferences.proxyPeerConnections} onChange={(value) => update("proxyPeerConnections", value)} />
              <BooleanSetting label="Enable proxy authentication" value={preferences.proxyAuthEnabled} onChange={(value) => update("proxyAuthEnabled", value)} />
              <TextSetting label="Username" value={preferences.proxyUsername} onChange={(value) => update("proxyUsername", value)} />
              <label className="engine-field">Password<input type="password" value={preferences.proxyPassword} placeholder={preferences.proxyPasswordConfigured ? "Saved — leave blank to keep" : "Not configured"} onChange={(event) => update("proxyPassword", event.target.value)} /><small>The stored password is never sent back to the desktop.</small></label>
              <BooleanSetting label="Use proxy only for torrents" value={preferences.proxyTorrentsOnly} onChange={(value) => update("proxyTorrentsOnly", value)} />
            </>
          ) : (
            <>
              <h3>Engine diagnostics</h3>
              {engineInfo ? <><ReadOnlySetting label="qBittorrent version" value={engineInfo.version} /><ReadOnlySetting label="Web API version" value={engineInfo.webApiVersion} /><ReadOnlySetting label="Network status" value={engineInfo.connectionStatus} /><ReadOnlySetting label="Free space" value={fmtSize(engineInfo.freeSpace)} /><BooleanSetting label="Use alternative speed limits now" value={engineInfo.alternativeSpeedLimits} onChange={async () => setEngineInfo(await api.toggleAlternativeSpeedLimits())} /><div className="engine-log"><strong>Recent sanitized qBittorrent log</strong>{engineInfo.recentLogs.length ? engineInfo.recentLogs.map((entry) => <code key={entry.id}>{new Date(entry.timestamp * 1000).toLocaleString()} · {entry.message}</code>) : <small>No recent log entries.</small>}</div></> : <div className="settings-loading">Loading diagnostics…</div>}
              <button className="quiet" onClick={loadEngineInfo}>Refresh diagnostics</button>
            </>
          )}
          {notice && <div className="settings-success"><CheckCircle2 /> {notice}</div>}
          {preferences && error && <div className="error"><AlertTriangle /> {error}</div>}
        </div>
      </div>
    </section>
  );
}

function BooleanSetting({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="engine-toggle"><span>{label}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /></label>;
}
function NumberSetting({ label, value, min = 0, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="engine-field">{label}<input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function TextSetting({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="engine-field">{label}<input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function SpeedSetting({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="engine-field">{label}<div className="unit-input"><input type="number" min={0} value={Math.round(value / 1024)} onChange={(event) => onChange(Number(event.target.value) * 1024)} /><span>KiB/s</span></div><small>0 means unlimited.</small></label>;
}
function ReadOnlySetting({ label, value }: { label: string; value: string }) {
  return <label className="engine-field">{label}<input value={value} readOnly /><small>Managed by Harbor's Docker storage mapping for safety.</small></label>;
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
