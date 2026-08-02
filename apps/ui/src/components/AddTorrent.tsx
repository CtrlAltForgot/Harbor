import { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  HardDrive,
  Link2,
  Server,
  X,
} from "lucide-react";
import type { Category, RetentionPolicy } from "@harbor/contracts";
import { api } from "../lib/api";
import { extractMagnets } from "../lib/magnets";

export function AddTorrent({
  close,
  added,
  initialFile,
}: {
  close: () => void;
  added: () => void;
  initialFile?: { name: string; base64: string } | null;
}) {
  const [magnet, setMagnet] = useState("");
  const [torrentFile, setTorrentFile] = useState<{
    name: string;
    base64: string;
  } | null>(initialFile ?? null);
  const [category, setCategory] = useState<Category>("auto"),
    [retention, setRetention] = useState<RetentionPolicy>("remove");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const magnets = extractMagnets(magnet);
  async function choose(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".torrent")) {
      setError("Choose a .torrent file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Torrent files must be smaller than 10 MB");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    setTorrentFile({ name: file.name, base64: btoa(binary) });
    setMagnet("");
    setError("");
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (torrentFile) {
        await api.add({
          torrentBase64: torrentFile.base64,
          fileName: torrentFile.name,
          category,
          retention,
          mode: "server",
        });
        added();
        close();
        return;
      }
      if (!magnets.length)
        throw new Error("Paste at least one valid magnet link");
      const failures: { magnet: string; error: string }[] = [];
      let succeeded = 0;
      for (const link of magnets) {
        try {
          await api.add({ magnet: link, category, retention, mode: "server" });
          succeeded++;
        } catch (e) {
          failures.push({
            magnet: link,
            error: e instanceof Error ? e.message : "Could not add torrent",
          });
        }
      }
      if (succeeded) added();
      if (!failures.length) {
        close();
        return;
      }
      setMagnet(failures.map((failure) => failure.magnet).join("\n"));
      setError(
        `${succeeded} added, ${failures.length} not added: ${failures
          .map((failure) => failure.error)
          .join("; ")}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add torrent");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="scrim"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section className="sheet">
        <header>
          <div>
            <p className="eyebrow">NEW TRANSFER</p>
            <h2>Add to Harbor</h2>
          </div>
          <button className="icon-button" onClick={close}>
            <X />
          </button>
        </header>
        <div className="destination-banner">
          <span>
            <Server size={19} />
          </span>
          <div>
            <strong>Downloading on Unraid</strong>
            <small>Files will not be saved to this computer</small>
          </div>
          <span className="mode-label">Server mode</span>
        </div>
        <label>
          Magnet link{magnets.length > 1 ? "s" : ""}
          <div className="input-icon">
            <Link2 size={17} />
            <textarea
              autoFocus
              value={magnet}
              onChange={(e) => {
                setMagnet(e.target.value);
                setTorrentFile(null);
              }}
              placeholder={
                "Paste one or multiple magnet links, one per line\nmagnet:?xt=urn:btih:…"
              }
            />
          </div>
          {magnets.length > 1 && (
            <small className="batch-count">
              {magnets.length} unique torrents detected. The category and
              cleanup choice below will apply to all of them.
            </small>
          )}
        </label>
        <div className="file-choice">
          <span>or</span>
          <label>
            <input
              type="file"
              accept=".torrent,application/x-bittorrent"
              onChange={(e) => choose(e.target.files?.[0])}
            />
            {torrentFile
              ? `Selected: ${torrentFile.name}`
              : "Choose a .torrent file"}
          </label>
        </div>
        <div className="field-grid">
          <label>
            Category
            <div className="select-wrap">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {[
                  "auto",
                  "movie",
                  "tv",
                  "game",
                  "music",
                  "software",
                  "book",
                  "general",
                ].map((x) => (
                  <option value={x} key={x}>
                    {x === "auto"
                      ? "Detect automatically"
                      : x[0]!.toUpperCase() + x.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown />
            </div>
          </label>
          <label>
            After organization
            <div className="select-wrap">
              <select
                value={retention}
                onChange={(e) =>
                  setRetention(e.target.value as RetentionPolicy)
                }
              >
                <option value="remove">
                  Organize and clean downloads (recommended)
                </option>
                <option value="seed">Keep seeding and retain staging</option>
                <option value="stop">Stop torrent and retain staging</option>
                <option value="ask">Ask me</option>
              </select>
              <ChevronDown />
            </div>
          </label>
        </div>
        <div className="safe-note">
          <HardDrive size={17} />
          <span>
            <strong>The library copy is verified first.</strong> With the
            recommended option, Harbor then removes the torrent and deletes only
            its original incomplete-download path.
          </span>
        </div>
        {error && (
          <div className="error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        <footer>
          <button className="quiet" onClick={close}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={(!magnets.length && !torrentFile) || busy}
            onClick={submit}
          >
            {busy
              ? `Adding${magnets.length > 1 ? ` ${magnets.length} torrents` : ""}…`
              : magnets.length > 1
                ? `Start ${magnets.length} torrents on server`
                : "Start on server"}
          </button>
        </footer>
      </section>
    </div>
  );
}
