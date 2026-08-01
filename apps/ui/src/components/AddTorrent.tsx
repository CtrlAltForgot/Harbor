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

export function AddTorrent({
  close,
  added,
}: {
  close: () => void;
  added: () => void;
}) {
  const [magnet, setMagnet] = useState("");
  const [torrentFile, setTorrentFile] = useState<{
    name: string;
    base64: string;
  } | null>(null);
  const [category, setCategory] = useState<Category>("auto"),
    [retention, setRetention] = useState<RetentionPolicy>("remove");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
      await api.add(
        torrentFile
          ? {
              torrentBase64: torrentFile.base64,
              fileName: torrentFile.name,
              category,
              retention,
              mode: "server",
            }
          : { magnet, category, retention, mode: "server" },
      );
      added();
      close();
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
          <button>Server mode</button>
        </div>
        <label>
          Magnet link
          <div className="input-icon">
            <Link2 size={17} />
            <textarea
              autoFocus
              value={magnet}
              onChange={(e) => {
                setMagnet(e.target.value);
                setTorrentFile(null);
              }}
              placeholder="magnet:?xt=urn:btih:…"
            />
          </div>
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
            disabled={(!magnet && !torrentFile) || busy}
            onClick={submit}
          >
            {busy ? "Adding…" : "Start on server"}
          </button>
        </footer>
      </section>
    </div>
  );
}
