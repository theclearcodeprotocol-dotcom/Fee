/**
 * `/metricool competitors`: turn Metricool's competitor data (saved by Claude
 * into data/metricool/competitors.json and competitor-reels.json, made with the
 * metric lists in lib/metricool.ts, in that order) into data/competitors.json.
 *
 *   npm run metricool:competitors
 *
 * Free route (no Apify): the accounts are whatever you track under Competitors
 * in Metricool. Metricool gives likes, comments, caption and link — no views and
 * no video — so reels are ranked by likes, the hook is the caption's opening
 * line, and there's no transcript or on-screen text.
 * Top 5 per account from the last 7 days, topped up from the last 30.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { read, write } from "../lib/store.ts";
import { fromMetricoolStamp, num } from "../lib/metricool.ts";
import type { CompetitorReel, CompetitorsFile, TrackedCreator } from "../lib/types.ts";

const RAW = join(process.cwd(), "data", "metricool");
type Rows = { rows: unknown[][] };
const load = async (name: string) => JSON.parse(await readFile(join(RAW, name), "utf8")) as Rows;
const handle = (v: unknown) => `@${String(v ?? "").replace(/^@/, "")}`;

const [accounts, reelsRaw] = await Promise.all([load("competitors.json"), load("competitor-reels.json")]);
const file: CompetitorsFile = await read("competitors");
const oldNiche = new Map(file.meta.sample ? [] : file.creators.map((c) => [c.handle, c.niche]));

// accounts: [handle, display name, followers]
const creators: TrackedCreator[] = accounts.rows
  .filter((r) => r[0])
  .map((r) => ({ handle: handle(r[0]), name: String(r[1] ?? r[0]).toLowerCase(), niche: oldNiche.get(handle(r[0])) ?? "", followers: num(r[2]) }));

if (!creators.length) {
  console.error("no competitors in Metricool yet — add the accounts under Competitors (Instagram) in Metricool, then run /metricool competitors again");
  process.exit(1);
}

// reels: [handle, id, text, url, published, likes, comments]
const all: CompetitorReel[] = reelsRaw.rows.map((r, i) => {
  const caption = String(r[2] ?? "");
  const first = caption.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return {
    id: String(r[1] ?? r[3] ?? `reel_${i}`),
    creator: handle(r[0]),
    hook: first.slice(0, 160) || "(no caption)",
    caption,
    likes: num(r[5]),
    comments: num(r[6]),
    postedAt: fromMetricoolStamp(String(r[4] ?? "")),
    url: r[3] ? String(r[3]) : undefined,
    source: "metricool",
  };
});

const now = Date.now();
const age = (r: CompetitorReel) => (now - new Date(r.postedAt).getTime()) / 864e5;
const picked = creators.flatMap((c) => {
  const mine = all.filter((r) => r.creator.toLowerCase() === c.handle.toLowerCase()).sort((a, b) => b.likes - a.likes);
  return [...mine.filter((r) => age(r) <= 7), ...mine.filter((r) => age(r) > 7 && age(r) <= 30)].slice(0, 5);
});

const out: CompetitorsFile = {
  meta: { sample: false, source: "metricool competitors (likes — metricool has no competitor views)", updatedAt: new Date().toISOString() },
  creators,
  reels: picked.sort((a, b) => b.likes - a.likes),
};
await write("competitors", out);
console.log(`saved ${out.reels.length} reels from ${creators.length} accounts`);
