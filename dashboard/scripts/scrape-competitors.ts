/**
 * Weekly competitor scrape → data/competitors.json.
 *
 *   APIFY_TOKEN=… npm run scrape:competitors
 *
 * Decision: Instagram has no API for other people's reels, so this uses the
 * Apify "Instagram Reel Scraper" actor (pay-per-result) through its
 * run-sync-get-dataset-items endpoint. The creators list is kept from the
 * existing file — edit data/competitors.json `creators` to change who is
 * tracked. Each creator's medianViews is recomputed from what was scraped.
 *
 * NOTE: the field names in `toReel` follow the actor's documented output at
 * the time of writing; check one run's raw output (saved next to the data file
 * as competitors.raw.json) and adjust if the actor changes.
 *
 * Schedule it weekly (cron, GitHub Actions, or a Claude Code scheduled task):
 *   0 7 * * 1  cd dashboard && npm run scrape:competitors
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CompetitorReel, CompetitorsFile } from "../lib/types.ts";

const DATA = join(import.meta.dirname, "..", "data", "competitors.json");
const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error("set APIFY_TOKEN (https://console.apify.com/account/integrations)");
  process.exit(1);
}
const ACTOR = process.env.APIFY_REEL_ACTOR ?? "apify~instagram-reel-scraper";
const PER_CREATOR = Number(process.env.REELS_PER_CREATOR ?? 12);

const file = JSON.parse(await readFile(DATA, "utf8")) as CompetitorsFile;
const usernames = file.creators.map((c) => c.handle.replace(/^@/, ""));

const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: usernames, resultsLimit: PER_CREATOR }),
});
if (!res.ok) {
  console.error(`Apify error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const raw = (await res.json()) as Record<string, unknown>[];
await writeFile(DATA.replace(".json", ".raw.json"), JSON.stringify(raw, null, 2));

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

function toReel(item: Record<string, unknown>, i: number): CompetitorReel {
  const caption = str(item.caption);
  return {
    id: str(item.shortCode) || str(item.id) || `reel_${i}`,
    creator: `@${str(item.ownerUsername)}`,
    // first line of the caption stands in for the spoken hook until it is transcribed
    hook: caption.split("\n")[0].slice(0, 140) || "(no caption)",
    caption,
    views: num(item.videoPlayCount) || num(item.videoViewCount),
    likes: num(item.likesCount),
    comments: num(item.commentsCount),
    postedAt: str(item.timestamp) || new Date().toISOString(),
    url: str(item.url) || undefined,
  };
}

const all = raw.map(toReel);
const weekAgo = Date.now() - 7 * 864e5;
for (const c of file.creators) {
  const views = all.filter((r) => r.creator === c.handle).map((r) => r.views).sort((a, b) => a - b);
  if (views.length) c.medianViews = views[Math.floor(views.length / 2)];
}
file.reels = all.filter((r) => new Date(r.postedAt).getTime() >= weekAgo);
file.meta = { sample: false, source: `apify ${ACTOR}`, updatedAt: new Date().toISOString() };
await writeFile(DATA, JSON.stringify(file, null, 2) + "\n");
console.log(`saved ${file.reels.length} reels from the last 7 days (${all.length} scraped)`);
