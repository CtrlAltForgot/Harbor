import type {
  AddTorrentRequest,
  HarborSettings,
  ServerStatus,
  Torrent,
} from "@harbor/contracts";
const KEY = "harbor.connection";
export interface Connection {
  baseUrl: string;
  token: string;
  serverName: string;
}
export const connection = {
  get(): Connection | null {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  },
  set(value: Connection) {
    localStorage.setItem(KEY, JSON.stringify(value));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
async function request<T>(path: string, init: RequestInit = {}) {
  const saved = connection.get();
  if (!saved) throw new Error("Pair with your server first");
  const response = await fetch(`${saved.baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${saved.token}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const api = {
  async pair(baseUrl: string, code: string) {
    const clean = baseUrl.replace(/\/$/, "");
    const response = await fetch(`${clean}/api/v1/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, label: "Harbor Desktop" }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Pairing failed");
    connection.set({
      baseUrl: clean,
      token: body.token,
      serverName: body.serverName,
    });
    return body;
  },
  status: () => request<ServerStatus>("/api/v1/status"),
  list: () => request<Torrent[]>("/api/v1/torrents"),
  settings: () => request<HarborSettings>("/api/v1/settings"),
  directories: (path = "/media") =>
    request<{ path: string; directories: string[] }>(
      `/api/v1/settings/directories?path=${encodeURIComponent(path)}`,
    ),
  saveSettings: (input: {
    moviesDir: string;
    tvDir: string;
    reviewDir: string;
    metadataLanguage: string;
    tmdbAccessToken?: string;
  }) =>
    request<HarborSettings>("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  add: (input: AddTorrentRequest) =>
    request<Torrent>("/api/v1/torrents", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  action: (id: string, action: string) =>
    request<Torrent>(`/api/v1/torrents/${id}/${action}`, { method: "POST" }),
  remove: (id: string) =>
    request<void>(`/api/v1/torrents/${id}`, { method: "DELETE" }),
  correct: (
    id: string,
    input: {
      category: string;
      title: string;
      season?: number;
      episode?: number;
    },
  ) =>
    request<Torrent>(`/api/v1/torrents/${id}/classification`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  filePriority: (id: string, ids: number[], priority: number) =>
    request<void>(`/api/v1/torrents/${id}/files/priority`, {
      method: "POST",
      body: JSON.stringify({ ids, priority }),
    }),
};
