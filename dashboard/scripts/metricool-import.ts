/**
 * Step 2 of `/metricool pull`: turn the raw Metricool responses Claude saved
 * into the analytics files.
 *
 *   npm run metricool:import
 *
 * Instagram → data/analytics.json, from data/metricool/evolution.json + reels.json
 * TikTok    → data/analytics-tiktok.json, from data/metricool/tiktok-evolution.json
 *             + tiktok-videos.json (skipped if those files aren't there)
 * Each raw file is the exact JSON a getAnalyticsDataByMetrics call returned
 * ({ rows: [...] }), made with the metric lists in lib/metricool.ts, in order.
 * Days already in a file are kept (Metricool's history only starts when the
 * account was connected), today is skipped (incomplete), notes are kept.
 * Prints the heaters that still need a "what made it pop" note.
 */
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { read, write } from "../lib/store.ts";
import { fromMetricoolStamp, num, optNum, zoned } from "../lib/metricool.ts";
import { scoreReels, isHeater, heaterStats } from "../lib/analytics.ts";
import type { AnalyticsFile, DailyMetric, Reel } from "../lib/types.ts";

const RAW = join(process.cwd(), "data", "metricool");
type Rows = { rows: unknown[][] };
const load = async (name: string) => JSON.parse(await readFile(join(RAW, name), "utf8")) as Rows;
const exists = (name: string) => access(join(RAW, name)).then(() => true, () => false);
const today = zoned(new Date().toISOString()).local.slice(0, 10);

interface PlatformSpec {
  file: "analytics" | "analytics-tiktok";
  label: string;
  defaultHandle: string;
  source: string;
  evolution: string;
  items: string;
  /** daily row (date already stripped) → metric, or null when Metricool has no data for that day */
  day: (row: unknown[], date: string) => DailyMetric | null;
  empty: (date: string) => DailyMetric;
  item: (row: unknown[]) => Reel;
}

const firstLine = (text: string) => text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";

const INSTAGRAM: PlatformSpec = {
  file: "analytics",
  label: "instagram",
  defaultHandle: "@theclearcode_",
  source: "metricool (instagram)",
  evolution: "evolution.json",
  items: "reels.json",
  // [views, reelsSaved, postsSaved, followersGained]
  day: (r, date) => (r[0] === null ? null : { date, views: num(r[0]), saves: num(r[1]) + num(r[2]), follows: num(r[3]) }),
  empty: (date) => ({ date, views: 0, saves: 0, follows: 0 }),
  // [datetime, text, id, url, views, saved, shares, comments, reach, retention, skipRate]
  item: (r) => {
    const line = firstLine(String(r[1] ?? ""));
    return {
      id: String(r[2]),
      title: line.slice(0, 80) || "(no caption)",
      hook: line.split(/(?<=[.!?…])\s/)[0] || line,
      postedAt: fromMetricoolStamp(String(r[0])),
      views: num(r[4]),
      saves: num(r[5]),
      shares: num(r[6]),
      follows: 0, // Metricool has no per-reel follows
      comments: num(r[7]),
      reach: optNum(r[8]),
      retention: optNum(r[9]),
      skipRate: optNum(r[10]),
      url: r[3] ? String(r[3]) : undefined,
    };
  },
};

const TIKTOK: PlatformSpec = {
  file: "analytics-tiktok",
  label: "tiktok",
  defaultHandle: "@theclearcode_acne",
  source: "metricool (tiktok)",
  evolution: "tiktok-evolution.json",
  items: "tiktok-videos.json",
  // [video views, followers gained, likes, shares]
  day: (r, date) => (r[0] === null ? null : { date, views: num(r[0]), follows: num(r[1]), likes: num(r[2]), shares: num(r[3]) }),
  empty: (date) => ({ date, views: 0, follows: 0, likes: 0, shares: 0 }),
  // [datetime, description, url, views, likes, comments, shares, reach, fullWatchRate, forYou]
  item: (r) => {
    const line = firstLine(String(r[1] ?? ""));
    return {
      id: String(r[2] ?? r[0]),
      title: line.slice(0, 80) || "(no description)",
      hook: line.split(/(?<=[.!?…])\s/)[0] || line,
      postedAt: fromMetricoolStamp(String(r[0])),
      views: num(r[3]),
      likes: num(r[4]),
      saves: 0, // Metricool has no TikTok saves
      shares: num(r[6]),
      follows: 0,
      comments: num(r[5]),
      reach: optNum(r[7]),
      fullWatchRate: optNum(r[8]),
      forYouRate: optNum(r[9]),
      url: r[2] ? String(r[2]) : undefined,
    };
  },
};

async function importPlatform(spec: PlatformSpec) {
  if (!(await exists(spec.evolution)) || !(await exists(spec.items))) {
    console.log(`${spec.label}: no raw files — skipped`);
    return;
  }
  const [evolution, itemsRaw] = await Promise.all([load(spec.evolution), load(spec.items)]);
  const file: AnalyticsFile = await read(spec.file);
  const fresh = file.meta.sample;

  const days = new Map<string, DailyMetric>((fresh ? [] : file.daily).map((d) => [d.date, d]));
  const incoming = new Map<string, DailyMetric>();
  for (const row of evolution.rows) {
    const stamp = String(row.at(-1));
    const date = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
    if (date >= today) continue; // incomplete
    const d = spec.day(row.slice(0, -1), date);
    if (d) incoming.set(date, d);
  }
  // fill gaps between the first and last day returned (a quiet day is a 0, not missing)
  const dates = [...incoming.keys()].sort();
  if (dates.length) {
    for (let d = new Date(`${dates[0]}T00:00:00Z`); d.toISOString().slice(0, 10) <= dates.at(-1)!; d = new Date(d.getTime() + 864e5)) {
      const key = d.toISOString().slice(0, 10);
      days.set(key, incoming.get(key) ?? spec.empty(key));
    }
  }

  const notes = new Map(file.reels.map((r) => [r.id, r.note]));
  const items = itemsRaw.rows.map(spec.item).map((r) => ({ ...r, note: fresh ? undefined : notes.get(r.id) }));
  const kept = fresh ? [] : file.reels.filter((r) => !items.some((n) => n.id === r.id));
  const all = [...kept, ...items].sort((a, b) => a.postedAt.localeCompare(b.postedAt));

  const out: AnalyticsFile = {
    meta: { sample: false, source: spec.source, updatedAt: new Date().toISOString() },
    handle: file.handle && !fresh ? file.handle : spec.defaultHandle,
    daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-180),
    reels: all,
  };
  await write(spec.file, out);
  console.log(`${spec.label}: ${out.daily.length} days (${out.daily[0]?.date ?? "—"} → ${out.daily.at(-1)?.date ?? "—"}), ${all.length} ${spec.label === "tiktok" ? "videos" : "reels"}`);

  const needNotes = scoreReels(all).filter((h) => isHeater(h) && !h.reel.note);
  if (needNotes.length) {
    console.log(`  heaters that need a one-line "what made it pop" note (write into data/${spec.file}.json → reels[].note):`);
    for (const h of needNotes) console.log(`  - ${h.reel.id} “${h.reel.title}”\n    ${heaterStats(h, all)}`);
  }
}

await importPlatform(INSTAGRAM);
await importPlatform(TIKTOK);
