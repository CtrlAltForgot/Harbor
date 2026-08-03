import { describe, expect, it } from "vitest";
import { PIA_PROXY_HOST, PIA_PROXY_PORT, piaProxyPreferences, qbitPreferencesSchema } from "../src/app.js";

describe("qBittorrent preference validation", () => {
  it("accepts qBittorrent's disabled-limit sentinel values", () => {
    const parsed = qbitPreferencesSchema.safeParse({
      savePath: "/downloads/incomplete", tempPath: "/downloads/incomplete", tempPathEnabled: true,
      createSubfolder: true, preallocateAll: false, incompleteExtension: false, startPaused: false,
      listenPort: 6881, upnp: true, maxConnections: 500, maxConnectionsPerTorrent: 100, maxUploadsPerTorrent: 20,
      downloadLimit: 0, uploadLimit: 0, alternativeDownloadLimit: 10240, alternativeUploadLimit: 10240,
      queueingEnabled: true, maxActiveDownloads: 5, maxActiveUploads: 3, maxActiveTorrents: 5, dontCountSlowTorrents: true,
      dht: true, pex: true, lsd: true, encryption: 0, anonymousMode: false,
      maxRatioEnabled: false, maxRatio: -1, maxRatioAction: 0, maxSeedingTimeEnabled: false, maxSeedingTime: -1,
      schedulerEnabled: false, scheduleFromHour: 8, scheduleFromMinute: 0, scheduleToHour: 20, scheduleToMinute: 0, schedulerDays: 0,
      proxyType: -1, proxyAddress: "", proxyPort: 0, proxyPeerConnections: false, proxyAuthEnabled: false,
      proxyUsername: "", proxyPassword: "", proxyPasswordConfigured: false, proxyTorrentsOnly: false,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("PIA proxy preset", () => {
  it("routes peers and hostname lookups through authenticated PIA SOCKS5", () => {
    expect(piaProxyPreferences("proxy-user", "secret")).toEqual({
      proxy_type: 4,
      proxy_ip: PIA_PROXY_HOST,
      proxy_port: PIA_PROXY_PORT,
      proxy_peer_connections: true,
      proxy_auth_enabled: true,
      proxy_username: "proxy-user",
      proxy_password: "secret",
      proxy_torrents_only: false,
      proxy_hostname_lookup: true,
    });
  });
});
