import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildApp } from "../src/app.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
async function setup() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "harbor-test-"));
  dirs.push(dataDir);
  const app = await buildApp({
    dataDir,
    pairingCode: "123456",
    engine: "mock",
  });
  return app;
}
async function token(app: Awaited<ReturnType<typeof setup>>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/pair",
    payload: { code: "123456", label: "Test" },
  });
  return response.json().token as string;
}
describe("companion API", () => {
  it("requires authentication", async () => {
    const app = await setup();
    expect((await app.inject({ url: "/api/v1/torrents" })).statusCode).toBe(
      401,
    );
    await app.close();
  });
  it("pairs with the configured code", async () => {
    const app = await setup();
    expect(await token(app)).toMatch(/^hbr_/);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/pair",
          payload: { code: "wrong", label: "Test" },
        })
      ).statusCode,
    ).toBe(401);
    await app.close();
  });
  it("submits and rejects a duplicate magnet", async () => {
    const app = await setup();
    const auth = `Bearer ${await token(app)}`;
    const payload = {
      magnet:
        "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Example.Movie.2025.1080p",
      category: "movie",
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/torrents",
          headers: { authorization: auth },
          payload,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/torrents",
          headers: { authorization: auth },
          payload,
        })
      ).statusCode,
    ).toBe(409);
    await app.close();
  });
  it("persists torrents across restart", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "harbor-test-"));
    dirs.push(dataDir);
    let app = await buildApp({ dataDir, pairingCode: "x", engine: "mock" });
    let auth = `Bearer ${await tokenWith(app, "x")}`;
    await app.inject({
      method: "POST",
      url: "/api/v1/torrents",
      headers: { authorization: auth },
      payload: {
        magnet:
          "magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&dn=Show.S02E05",
      },
    });
    await app.close();
    app = await buildApp({ dataDir, pairingCode: "x", engine: "mock" });
    auth = `Bearer ${await tokenWith(app, "x")}`;
    expect(
      (
        await app.inject({
          url: "/api/v1/torrents",
          headers: { authorization: auth },
        })
      ).json(),
    ).toHaveLength(1);
    await app.close();
  });
  it("validates media settings and never returns the TMDB token", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "harbor-media-"));
    const dataDir = mkdtempSync(path.join(tmpdir(), "harbor-test-"));
    dirs.push(root, dataDir);
    for (const name of ["Movies", "TV Shows", "Needs Review"])
      mkdirSync(path.join(root, name));
    const app = await buildApp({
      dataDir,
      pairingCode: "x",
      engine: "mock",
      mediaRoot: root,
      destinations: {
        movie: path.join(root, "Movies"),
        tv: path.join(root, "TV Shows"),
        review: path.join(root, "Needs Review"),
      },
    });
    const auth = `Bearer ${await tokenWith(app, "x")}`;
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/settings",
      headers: { authorization: auth },
      payload: {
        moviesDir: path.join(root, "Movies"),
        tvDir: path.join(root, "TV Shows"),
        reviewDir: path.join(root, "Needs Review"),
        metadataLanguage: "en-US",
        tmdbAccessToken: "very-secret",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tmdbConfigured: true,
      moviesDir: path.join(root, "Movies"),
    });
    expect(response.body).not.toContain("very-secret");
    const escaped = await app.inject({
      method: "PUT",
      url: "/api/v1/settings",
      headers: { authorization: auth },
      payload: {
        moviesDir: "/tmp",
        tvDir: path.join(root, "TV Shows"),
        reviewDir: path.join(root, "Needs Review"),
        metadataLanguage: "en-US",
      },
    });
    expect(escaped.statusCode).toBe(400);
    await app.close();
  });
  it("updates an existing torrent cleanup policy", async () => {
    const app = await setup();
    const auth = `Bearer ${await token(app)}`;
    const added = await app.inject({
      method: "POST",
      url: "/api/v1/torrents",
      headers: { authorization: auth },
      payload: {
        magnet:
          "magnet:?xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb&dn=Example.Movie.2025",
        retention: "seed",
      },
    });
    const changed = await app.inject({
      method: "PATCH",
      url: `/api/v1/torrents/${added.json().id}/retention`,
      headers: { authorization: auth },
      payload: { retention: "remove" },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().retention).toBe("remove");
    await app.close();
  });
});
async function tokenWith(app: any, code: string) {
  return (
    await app.inject({
      method: "POST",
      url: "/api/v1/pair",
      payload: { code, label: "Test" },
    })
  ).json().token;
}
