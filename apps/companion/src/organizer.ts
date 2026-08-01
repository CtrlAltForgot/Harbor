import { constants } from "node:fs";
import {
  access,
  cp,
  mkdir,
  rename,
  rm,
  stat,
  statfs,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Classification } from "@harbor/contracts";

export interface OrganizationResult {
  source: string;
  destination: string;
  bytes: number;
  method: "copy";
}

export async function validateDestination(target: string) {
  await mkdir(target, { recursive: true });
  await access(target, constants.R_OK | constants.W_OK);
  const details = await stat(target);
  if (!details.isDirectory())
    throw new Error(`Destination is not a directory: ${target}`);
}

export async function cleanupStaging(source: string, incompleteRoot: string) {
  const resolvedRoot = path.resolve(incompleteRoot),
    resolvedSource = path.resolve(source);
  const relative = path.relative(resolvedRoot, resolvedSource);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(
      "Refusing to clean a path outside or equal to incomplete storage",
    );
  await rm(resolvedSource, { recursive: true, force: false });
  try {
    await stat(resolvedSource);
    throw new Error(`Staging cleanup verification failed: ${resolvedSource}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function organize(
  source: string,
  destinationRoot: string,
  classification: Classification,
): Promise<OrganizationResult> {
  await validateDestination(destinationRoot);
  classification = await reuseExistingSeriesFolder(
    destinationRoot,
    classification,
  );
  const sourceInfo = await stat(source);
  if (!sourceInfo.isFile() && !sourceInfo.isDirectory())
    throw new Error("Downloaded content is not a regular file or directory");
  const relative = buildRelativeName(source, classification);
  const destination = path.join(destinationRoot, relative);
  assertInside(destinationRoot, destination);
  let mergeIntoExistingSeason = false;
  try {
    const existing = await stat(destination);
    mergeIntoExistingSeason =
      classification.category === "tv" &&
      classification.episode === undefined &&
      sourceInfo.isDirectory() &&
      existing.isDirectory();
    if (!mergeIntoExistingSeason)
      throw new Error(
        `Organization destination already exists: ${destination}`,
      );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = `${destination}.harbor-${randomUUID()}.partial`;
  await mkdir(path.dirname(destination), { recursive: true });
  const sourceBytes = await treeSize(source);
  const filesystem = await statfs(destinationRoot);
  const available = Number(filesystem.bavail) * Number(filesystem.bsize);
  if (available < sourceBytes + 64 * 1024 * 1024)
    throw new Error(
      `Insufficient destination space: need ${sourceBytes} bytes, have ${available}`,
    );
  try {
    await cp(source, temporary, {
      recursive: true,
      errorOnExist: true,
      preserveTimestamps: true,
    });
    await normalizePrimaryVideo(temporary, classification);
    await normalizeSeasonPack(temporary, classification);
    const targetBytes = await treeSize(temporary);
    if (sourceBytes !== targetBytes)
      throw new Error(
        `Copy verification failed: expected ${sourceBytes} bytes, found ${targetBytes}`,
      );
    if (mergeIntoExistingSeason) {
      const manifest = await fileManifest(temporary);
      await assertMergeHasNoCollisions(temporary, destination);
      await mergeTree(temporary, destination);
      for (const [relative, size] of manifest) {
        const merged = await stat(path.join(destination, relative));
        if (!merged.isFile() || merged.size !== size)
          throw new Error(`Merged file verification failed: ${relative}`);
      }
      await rm(temporary, { recursive: true, force: true });
    } else await rename(temporary, destination);
    return { source, destination, bytes: targetBytes, method: "copy" };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

async function reuseExistingSeriesFolder(
  root: string,
  classification: Classification,
): Promise<Classification> {
  if (classification.category !== "tv") return classification;
  const wanted = normalizeLibraryName(classification.title);
  const candidates = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      normalized: normalizeLibraryName(entry.name),
    }));
  const matches = candidates.filter(
    (candidate) =>
      candidate.normalized === wanted ||
      prefixAlias(candidate.normalized, wanted),
  );
  if (matches.length !== 1) return classification;
  return {
    ...classification,
    title: matches[0]!.name,
    reasons: [
      ...classification.reasons,
      "matched existing library series folder",
    ],
  };
}
function normalizeLibraryName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s*[([]?(?:19|20)\d{2}[)\]]?\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function prefixAlias(a: string, b: string) {
  const shorter = a.length <= b.length ? a : b,
    longer = a.length > b.length ? a : b;
  return shorter.length >= 8 && longer.startsWith(`${shorter} `);
}
async function fileManifest(
  root: string,
  relative = "",
  found = new Map<string, number>(),
): Promise<Map<string, number>> {
  for (const entry of await readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) await fileManifest(root, child, found);
    else if (entry.isFile())
      found.set(child, (await stat(path.join(root, child))).size);
  }
  return found;
}
async function assertMergeHasNoCollisions(
  source: string,
  destination: string,
  relative = "",
): Promise<void> {
  for (const entry of await readdir(path.join(source, relative), {
    withFileTypes: true,
  })) {
    const child = path.join(relative, entry.name),
      target = path.join(destination, child);
    try {
      const existing = await stat(target);
      if (entry.isDirectory() && existing.isDirectory())
        await assertMergeHasNoCollisions(source, destination, child);
      else
        throw new Error(
          `Organization would overwrite existing library content: ${target}`,
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
async function mergeTree(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name),
      to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await mergeTree(from, to);
      await rm(from, { recursive: true, force: true });
    } else await rename(from, to);
  }
}

export function buildRelativeName(
  source: string,
  classification: Classification,
) {
  const sourceName = path.basename(source);
  const extension = path.extname(sourceName);
  const canonical =
    classification.category === "movie" &&
    classification.year &&
    !classification.title.includes(String(classification.year))
      ? `${classification.title} (${classification.year})`
      : classification.title;
  const safeTitle = sanitize(canonical) || "Untitled";
  if (classification.category === "movie")
    return extension
      ? path.join(safeTitle, `${safeTitle}${extension.toLowerCase()}`)
      : safeTitle;
  if (classification.category === "tv") {
    const season = classification.season ?? 0;
    const seasonFolder = `Season ${String(season).padStart(2, "0")}`;
    if (extension && classification.episode !== undefined)
      return path.join(
        safeTitle,
        seasonFolder,
        `${safeTitle} - S${String(season).padStart(2, "0")}E${String(classification.episode).padStart(2, "0")}${extension.toLowerCase()}`,
      );
    return path.join(safeTitle, seasonFolder);
  }
  return safeTitle;
}
function sanitize(value: string) {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}
function assertInside(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Organization target escapes its configured destination");
}
async function treeSize(target: string): Promise<number> {
  const details = await stat(target);
  if (details.isFile()) return details.size;
  let total = 0;
  for (const entry of await readdir(target))
    total += await treeSize(path.join(target, entry));
  return total;
}
async function normalizePrimaryVideo(
  target: string,
  classification: Classification,
) {
  if (
    classification.category !== "movie" &&
    !(classification.category === "tv" && classification.episode !== undefined)
  )
    return;
  if (!(await stat(target)).isDirectory()) return;
  const videos = await findVideos(target);
  if (!videos.length) return;
  videos.sort((a, b) => b.size - a.size);
  const primary = videos[0]!;
  const extension = path.extname(primary.path).toLowerCase();
  const safeTitle = sanitize(classification.title) || "Untitled";
  const base =
    classification.category === "movie"
      ? safeTitle
      : `${safeTitle} - S${String(classification.season ?? 0).padStart(2, "0")}E${String(classification.episode).padStart(2, "0")}`;
  const finalPath = path.join(target, `${base}${extension}`);
  if (path.resolve(primary.path) !== path.resolve(finalPath)) {
    try {
      await stat(finalPath);
      throw new Error(`Normalized media filename already exists: ${finalPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await rename(primary.path, finalPath);
    await renameMatchingCompanions(
      path.dirname(primary.path),
      path.basename(primary.path, extension),
      base,
    );
  }
}
async function normalizeSeasonPack(
  target: string,
  classification: Classification,
) {
  if (
    classification.category !== "tv" ||
    classification.episode !== undefined ||
    !(await stat(target)).isDirectory()
  )
    return;
  const videos = await findVideos(target);
  for (const video of videos) {
    const parsed = path
      .basename(video.path)
      .match(/(?:s(\d{1,2})e(\d{1,3})|(\d{1,2})x(\d{1,3}))/i);
    if (!parsed) continue;
    const season = Number(parsed[1] ?? parsed[3]);
    const episode = Number(parsed[2] ?? parsed[4]);
    if (classification.season !== undefined && season !== classification.season)
      continue;
    const extension = path.extname(video.path).toLowerCase();
    const oldBase = path.basename(video.path, extension);
    const base = `${sanitize(classification.title)} - S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
    const finalPath = path.join(target, `${base}${extension}`);
    await ensureAbsent(finalPath);
    await rename(video.path, finalPath);
    await moveMatchingCompanions(
      path.dirname(video.path),
      target,
      oldBase,
      base,
    );
  }
}
async function findVideos(
  target: string,
): Promise<Array<{ path: string; size: number }>> {
  const found: Array<{ path: string; size: number }> = [];
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) found.push(...(await findVideos(full)));
    else if (
      entry.isFile() &&
      /\.(mkv|mp4|avi|m4v|mov|webm)$/i.test(entry.name)
    )
      found.push({ path: full, size: (await stat(full)).size });
  }
  return found;
}
async function renameMatchingCompanions(
  root: string,
  oldBase: string,
  newBase: string,
) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(
      /^(.*?)(\.(?:[a-z]{2,3}\.)?(?:srt|ass|ssa|vtt|sub))$/i,
    );
    if (match?.[1] === oldBase)
      await rename(
        path.join(root, entry.name),
        path.join(root, `${newBase}${match[2]}`),
      );
  }
}
async function moveMatchingCompanions(
  sourceDir: string,
  targetDir: string,
  oldBase: string,
  newBase: string,
) {
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(
      /^(.*?)(\.(?:[a-z]{2,3}\.)?(?:srt|ass|ssa|vtt|sub))$/i,
    );
    if (match?.[1] !== oldBase) continue;
    const destination = path.join(targetDir, `${newBase}${match[2]}`);
    await ensureAbsent(destination);
    await rename(path.join(sourceDir, entry.name), destination);
  }
}
async function ensureAbsent(target: string) {
  try {
    await stat(target);
    throw new Error(`Normalized media filename already exists: ${target}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
