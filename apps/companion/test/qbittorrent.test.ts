import { describe, expect, it, vi } from "vitest";
import { QbitClient } from "../src/qbittorrent.js";
import { loadConfig } from "../src/config.js";

describe("qBittorrent adapter", () => {
  it("confirms submissions, controls, and removal against live engine state", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    let present = false,
      state = "downloading";
    vi.stubGlobal(
      "fetch",
      async (input: string | URL | Request, init: RequestInit = {}) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.endsWith("/auth/login"))
          return new Response("Ok.", {
            headers: { "set-cookie": "SID=test-session; HttpOnly; path=/" },
          });
        if (url.endsWith("/app/version")) return new Response("5.1.0");
        if (url.endsWith("/app/webapiVersion")) return new Response("2.11.4");
        if (url.endsWith("/transfer/info")) return Response.json({ connection_status: "connected", use_alt_speed_limits: false, free_space_on_disk: 4096 });
        if (url.includes("/log/main")) return Response.json([{ id: 1, timestamp: 2, type: 1, message: "ready" }]);
        if (url.endsWith("/torrents/add")) present = true;
        if (url.endsWith("/torrents/stop")) state = "stoppedDL";
        if (url.endsWith("/torrents/start")) state = "downloading";
        if (url.endsWith("/torrents/delete")) present = false;
        if (url.endsWith("/app/preferences"))
          return Response.json({ dl_limit: 1024, queueing_enabled: true });
        if (url.includes("/torrents/info"))
          return Response.json(
            present
              ? [
                  {
                    hash: "abc",
                    name: "Show.S01E02",
                    state,
                    progress: 0.5,
                    dlspeed: 1000,
                    upspeed: 20,
                    eta: 30,
                    num_seeds: 3,
                    num_leechs: 2,
                    total_size: 100,
                    downloaded: 50,
                    save_path: "/downloads/incomplete",
                    content_path: "/downloads/incomplete/Show.S01E02",
                    added_on: 1,
                    completion_on: -1,
                  },
                ]
              : [],
          );
        return new Response("Ok.");
      },
    );
    const client = new QbitClient(
      loadConfig({
        qbitUrl: "http://qbit.test",
        qbitUsername: "admin",
        qbitPassword: "secret",
      }),
    );
    await client.health();
    await client.addMagnet("magnet:?xt=urn:btih:abc", "tv", "abc");
    expect((await client.list())[0]).toMatchObject({ hash: "abc" });
    await client.action("abc", "pause");
    expect((await client.list())[0]?.state).toBe("stoppedDL");
    await client.action("abc", "resume");
    expect((await client.list())[0]?.state).toBe("downloading");
    await client.remove("abc", true);
    expect(await client.list()).toHaveLength(0);
    const remove = calls.find((call) => call.url.endsWith("/torrents/delete"))!;
    expect(String(remove.init.body)).toContain("deleteFiles=true");
    expect(await client.preferences()).toMatchObject({ dl_limit: 1024 });
    await client.setPreferences({ dl_limit: 2048, dht: false });
    expect(await client.engineInfo()).toMatchObject({ version: "5.1.0", webApiVersion: "2.11.4", connectionStatus: "connected", freeSpace: 4096 });
    await client.toggleAlternativeSpeedLimits();
    await client.command("abc", "reannounce");
    const preferences = calls.find((call) =>
      call.url.endsWith("/app/setPreferences"),
    )!;
    expect(String(preferences.init.body)).toContain("dl_limit%22%3A2048");
    expect(calls.some((call) => call.url.endsWith("/transfer/toggleSpeedLimitsMode"))).toBe(true);
    expect(calls.some((call) => call.url.endsWith("/torrents/reannounce"))).toBe(true);
    expect(calls.filter((call) => call.url.endsWith("/auth/login"))).toHaveLength(1);
    expect(
      calls.slice(1).every(
        (call) =>
          (call.init.headers as Record<string, string>).cookie ===
          "SID=test-session",
      ),
    ).toBe(true);
  });
});
