/**
 * Pull the 12 AI news feeds in lib/trend-sources.ts, tag each item for hook
 * potential (lib/hook-potential.ts) and write data/trending.json.
 *
 *   npm run trending:fetch            # last 7 days, top 15 per source
 *
 * No dependencies: a small RSS/Atom parser below handles the feeds we use.
 * A source that fails is skipped and reported; the rest still save. Run it on
 * a schedule (e.g. hourly cron, or a Claude Code scheduled task).
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { TREND_SOURCES } from "../lib/trend-sources.ts";
import { hookIdeaFor, potentialFromScore, scoreHookPotential } from "../lib/hook-potential.ts";
import type { TrendItem, TrendingFile } from "../lib/types.ts";

const DATA = join(import.meta.dirname, "..", "data", "trending.json");
const MAX_AGE_DAYS = Number(process.env.TRENDING_MAX_AGE_DAYS ?? 7);
const PER_SOURCE = Number(process.env.TRENDING_PER_SOURCE ?? 15);
const now = new Date();

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function parseFeed(xml: string) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((b) => {
    const atomLink = b.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    return {
      title: tag(b, "title"),
      link: tag(b, "link") || atomLink || "",
      summary: (tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 280),
      date: tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"),
    };
  });
}

const items: TrendItem[] = [];
const failed: string[] = [];

await Promise.all(
  TREND_SOURCES.map(async (source) => {
    try {
      const res = await fetch(source.url, {
        headers: { "user-agent": "clear-code-dashboard/0.1 (rss reader)", accept: "application/rss+xml, application/atom+xml, text/xml" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const entries = parseFeed(await res.text())
        .filter((e) => e.title && e.link)
        .map((e) => ({ ...e, publishedAt: new Date(e.date || now).toISOString() }))
        .filter((e) => now.getTime() - new Date(e.publishedAt).getTime() <= MAX_AGE_DAYS * 864e5)
        .slice(0, PER_SOURCE);
      for (const e of entries) {
        const score = scoreHookPotential(e.title, e.summary, e.publishedAt, now);
        items.push({
          id: createHash("sha1").update(e.link).digest("hex").slice(0, 12),
          sourceId: source.id,
          title: e.title,
          summary: e.summary,
          url: e.link,
          publishedAt: e.publishedAt,
          score,
          potential: potentialFromScore(score),
          hookIdea: hookIdeaFor(e.title),
          tags: [],
        });
      }
    } catch (err) {
      failed.push(`${source.name}: ${(err as Error).message}`);
    }
  }),
);

if (items.length === 0) {
  console.error(`no items fetched — data/trending.json left unchanged.\n${failed.join("\n")}`);
  process.exit(1);
}

// de-duplicate the same story syndicated across feeds
const seen = new Set<string>();
const unique = items
  .sort((a, b) => b.score - a.score)
  .filter((i) => {
    const k = i.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 60);
    return seen.has(k) ? false : (seen.add(k), true);
  });

const file: TrendingFile = {
  meta: { sample: false, source: `${TREND_SOURCES.length - failed.length}/${TREND_SOURCES.length} rss feeds`, updatedAt: now.toISOString() },
  sources: TREND_SOURCES.map(({ id, name, url }) => ({ id, name, url })),
  items: unique,
};
await writeFile(DATA, JSON.stringify(file, null, 2) + "\n");
console.log(`saved ${unique.length} items from ${TREND_SOURCES.length - failed.length} sources`);
if (failed.length) console.warn(`skipped:\n  ${failed.join("\n  ")}`);
