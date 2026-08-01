import type { Classification } from "@harbor/contracts";

const extensionGroups: Array<[Classification["category"], RegExp]> = [
  ["music", /\.(flac|mp3|m4a|ogg|wav)$/i],
  ["book", /\.(epub|mobi|azw3|pdf|cb[rz]|m4b)$/i],
  ["game", /\.(iso|xci|nsp|wbfs)$/i],
  ["software", /\.(exe|msi|dmg|appimage|deb|rpm)$/i],
];

export function classify(name: string, files: string[] = []): Classification {
  const haystack = [name, ...files].join(" ");
  const episodeMatches = [
    ...haystack.matchAll(/(?:s(\d{1,2})e(\d{1,3})|(\d{1,2})x(\d{1,3}))/gi),
  ];
  const episode = haystack.match(
    /(?:s(\d{1,2})e(\d{1,3})|(\d{1,2})x(\d{1,3}))/i,
  );
  const seasonPack = haystack.match(
    /(?:complete[ ._-]+)?season[ ._-]?(\d{1,2})|s(\d{1,2})[ ._-]?(?:complete|pack)/i,
  );
  const distinctEpisodes = new Set(
    episodeMatches.map(
      (match) => `${match[1] ?? match[3]}:${match[2] ?? match[4]}`,
    ),
  );
  if (distinctEpisodes.size > 1) {
    const first = episodeMatches[0]!;
    return {
      category: "tv",
      confidence: 0.97,
      reasons: ["multiple episode files"],
      title: cleanTvTitle(name),
      year: extractYear(name),
      season: Number(first[1] ?? first[3]),
    };
  }
  if (episode)
    return {
      category: "tv",
      confidence: 0.96,
      reasons: ["episode pattern"],
      title: cleanTvTitle(name),
      year: extractYear(name),
      season: Number(episode[1] ?? episode[3]),
      episode: Number(episode[2] ?? episode[4]),
    };
  if (seasonPack)
    return {
      category: "tv",
      confidence: 0.92,
      reasons: ["season pack pattern"],
      title: cleanTvTitle(name),
      year: extractYear(name),
      season: Number(seasonPack[1] ?? seasonPack[2]),
    };
  for (const [category, pattern] of extensionGroups)
    if (files.some((file) => pattern.test(file)))
      return {
        category,
        confidence: 0.82,
        reasons: [`${category} file extension`],
        title: cleanTitle(name),
      };
  const videos = files.filter((file) => /\.(mkv|mp4|avi|m4v)$/i.test(file));
  if (videos.length >= 1 && /(?:19|20)\d{2}/.test(name))
    return {
      category: "movie",
      confidence: 0.84,
      reasons: ["movie release name and video content"],
      title: cleanMovieTitle(name),
      year: extractYear(name),
    };
  return {
    category: "review",
    confidence: 0.28,
    reasons: ["no reliable local match"],
    title: cleanTitle(name),
  };
}

function cleanTitle(value: string) {
  return value
    .replace(/\.(torrent)$/i, "")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function cleanTvTitle(value: string) {
  return cleanTitle(value)
    .replace(
      /\b(?:s\d{1,2}e\d{1,3}|\d{1,2}x\d{1,3}|season\s*\d{1,2}|s\d{1,2}(?:\s*(?:complete|pack))?)\b.*$/i,
      "",
    )
    .replace(/\s*\b(?:19|20)\d{2}\b\s*$/, "")
    .trim();
}
function cleanMovieTitle(value: string) {
  const cleaned = cleanTitle(value);
  const match = cleaned.match(/^(.*?)[ (._-]*((?:19|20)\d{2})\b/);
  return match
    ? `${match[1]!.trim()} (${match[2]})`
    : stripReleaseTags(cleaned);
}
function stripReleaseTags(value: string) {
  return value
    .replace(
      /\b(?:2160p|1080p|720p|web[ .-]?dl|webrip|bluray|brrip|hdrip|x26[45]|h\.?26[45]|hevc|av1).*$/i,
      "",
    )
    .trim();
}
function extractYear(value: string) {
  const match = value.match(/\b((?:19|20)\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}
