import type {
  AddTorrentRequest,
  HarborSettings,
  QbitEngineInfo,
  QbitPreferences,
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
interface TransportResponse {
  status: number;
  body: string;
}
declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke<T>(command: string, args: Record<string, unknown>): Promise<T>;
      };
    };
  }
}
async function transport(
  url: string,
  init: RequestInit = {},
): Promise<TransportResponse> {
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);
  try {
    if (window.__TAURI__?.core)
      return await window.__TAURI__.core.invoke<TransportResponse>(
        "http_request",
        {
          method,
          url,
          body: typeof init.body === "string" ? init.body : null,
          authorization: headers.get("authorization"),
        },
      );
    const response = await fetch(url, init);
    return { status: response.status, body: await response.text() };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message !== "Load failed" &&
      error.message !== "Failed to fetch"
    )
      throw error;
    throw new Error(
      "Harbor could not reach that address. Confirm the Unraid IP, port 7331, and that the Harbor container is running.",
    );
  }
}
function parseBody<T>(response: TransportResponse): T {
  try {
    return JSON.parse(response.body) as T;
  } catch {
    throw new Error(
      `The server returned an unreadable response (${response.status})`,
    );
  }
}
async function request<T>(path: string, init: RequestInit = {}) {
  const saved = connection.get();
  if (!saved) throw new Error("Pair with your server first");
  const response = await transport(`${saved.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${saved.token}`,
      ...init.headers,
    },
  });
  if (response.status < 200 || response.status >= 300) {
    const body = parseBody<{ error?: string }>(response);
    if (response.status === 404 && path.startsWith("/api/v1/engine/"))
      throw new Error(
        "Your Unraid Harbor companion is older than this desktop. In the Harbor folder on Unraid, run: git pull && ./scripts/update-unraid.sh — then reopen Settings.",
      );
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : parseBody<T>(response);
}
export const api = {
  async pair(baseUrl: string, code: string) {
    const clean = baseUrl.replace(/\/$/, "");
    if (!/^https?:\/\//i.test(clean))
      throw new Error(
        "Enter the full address beginning with http:// or https://",
      );
    const response = await transport(`${clean}/api/v1/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, label: "Harbor Desktop" }),
    });
    const body = parseBody<{
      token: string;
      serverName: string;
      error?: string;
    }>(response);
    if (response.status < 200 || response.status >= 300)
      throw new Error(body.error || `Pairing failed (${response.status})`);
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
  enginePreferences: () =>
    request<QbitPreferences>("/api/v1/engine/preferences"),
  saveEnginePreferences: (input: QbitPreferences) =>
    request<QbitPreferences>("/api/v1/engine/preferences", {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  engineInfo: () => request<QbitEngineInfo>("/api/v1/engine/info"),
  toggleAlternativeSpeedLimits: () =>
    request<QbitEngineInfo>("/api/v1/engine/alternative-speed-limits/toggle", {
      method: "POST",
    }),
  add: (input: AddTorrentRequest) =>
    request<Torrent>("/api/v1/torrents", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  action: (id: string, action: string) =>
    request<Torrent>(`/api/v1/torrents/${id}/${action}`, { method: "POST" }),
  retention: (id: string, retention: "seed" | "stop" | "remove" | "ask") =>
    request<Torrent>(`/api/v1/torrents/${id}/retention`, {
      method: "PATCH",
      body: JSON.stringify({ retention }),
    }),
  remove: (id: string, deleteFiles = false) =>
    request<void>(`/api/v1/torrents/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ deleteFiles }),
    }),
  removeCompleted: () =>
    request<{
      requested: number;
      removed: number;
      failed: Array<{ id: string; name: string; error: string }>;
    }>("/api/v1/bulk/remove-completed", { method: "POST" }),
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
  limits: (id: string, download: number, upload: number) =>
    request<void>(`/api/v1/torrents/${id}/limits`, {
      method: "POST",
      body: JSON.stringify({ download, upload }),
    }),
};
