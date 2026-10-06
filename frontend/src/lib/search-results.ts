export type SearchSource = { title: string; url: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collect(value: unknown, found: SearchSource[], depth = 0): void {
  if (depth > 6 || value == null) return;
  if (typeof value === "string") {
    try { collect(JSON.parse(value), found, depth + 1); } catch { /* plain MCP text is not a source record */ }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collect(item, found, depth + 1));
    return;
  }
  if (!isRecord(value)) return;

  const rawUrl = value.url ?? value.link;
  const rawTitle = value.title ?? value.name;
  if (typeof rawUrl === "string" && typeof rawTitle === "string") {
    try {
      const url = new URL(rawUrl);
      if ((url.protocol === "http:" || url.protocol === "https:") && rawTitle.trim()) {
        found.push({ title: rawTitle.trim(), url: url.href });
      }
    } catch { /* ignore malformed URLs */ }
  }
  Object.values(value).forEach((child) => collect(child, found, depth + 1));
}

export function parseSources(result: unknown): SearchSource[] {
  const found: SearchSource[] = [];
  collect(result, found);
  const unique = new Map(found.map((source) => [source.url, source]));
  return Array.from(unique.values()).slice(0, 5);
}
