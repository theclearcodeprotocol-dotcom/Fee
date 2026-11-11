/**
 * Step 2 of `/metricool pull`: turn the two raw Metricool responses Claude
 * saved into data/analytics.json.
 *
 *   npm run metricool:import
 *
 * Reads data/metricool/evolution.json and data/metricool/reels.json — each the
 * exact JSON a getAnalyticsDataByMetrics call returned ({ rows: [...] }), made
 * with the metric lists in lib/metricool.ts, in that order.
 * Days already in the file are kept (Metricool's history only starts when the
 * account was connected), today is skipped (incomplete), notes on reels are kept.
 * Prints the heaters that still need a "what made it pop" note.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { read, write } from "../lib/store.ts";
import { METRICOOL, fromMetricoolStamp, num, optNum, zoned } from "../lib/metricool.ts";
import { scoreReels, isHeater, heaterStats } from "../lib/analytics.ts";
import type { AnalyticsFile, DailyMetric, Reel } from "../lib/types.ts";

const RAW = join(process.cwd(), "data", "metricool");
type Rows = { rows: unknown[][] };
const load = async (name: string) => JSON.parse(await readFile(join(RAW, name), "utf8")) as Rows;

const [evolution, reelsRaw] = await Promise.all([load("evolution.json"), load("reels.json")]);
const file: AnalyticsFile = await read("analytics");
const today = zoned(new Date().toISOString()).local.slice(0, 10);

// ---- daily: [views, reelsSaved, postsSaved, followersGained, date]
const days = new Map<string, DailyMetric>((file.meta.sample ? [] : file.daily).map((d) => [d.date, d]));
const incoming = new Map<string, DailyMetric>();
for (const row of evolution.rows) {
  const stamp = String(row[METRICOOL.evolutionMetrics.length]);
  const date = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`;
  if (date >= today || row[0] === null) continue; // no views = before Metricool's history starts
  incoming.set(date, { date, views: num(row[0]), saves: num(row[1]) + num(row[2]), follows: num(row[3]) });
}
// fill gaps between the first and last day Metricool returned with zeros (a quiet day is a 0, not missing)
const dates = [...incoming.keys()].sort();
if (dates.length) {
  for (let d = new Date(`${dates[0]}T00:00:00Z`); d.toISOString().slice(0, 10) <= dates.at(-1)!; d = new Date(d.getTime() + 864e5)) {
    const key = d.toISOString().slice(0, 10);
    days.set(key, incoming.get(key) ?? { date: key, views: 0, saves: 0, follows: 0 });
  }
}

// ---- reels: [datetime, text, id, url, views, saved, shares, comments, reach, retention, skipRate]
const notes = new Map(file.reels.map((r) => [r.id, r.note]));
const reels: Reel[] = reelsRaw.rows.map((r) => {
  const text = String(r[1] ?? "");
  const firstLine = text.split("\n")[0].trim();
  const id = String(r[2]);
  return {
    id,
    title: firstLine.slice(0, 80) || "(no caption)",
    hook: firstLine.split(/(?<=[.!?…])\s/)[0] || firstLine,
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
    note: file.meta.sample ? undefined : notes.get(id),
  };
});
// keep older reels Metricool no longer returns for this window
const keptReels = file.meta.sample ? [] : file.reels.filter((r) => !reels.some((n) => n.id === r.id));
const allReels = [...keptReels, ...reels].sort((a, b) => a.postedAt.localeCompare(b.postedAt));

const out: AnalyticsFile = {
  meta: { sample: false, source: "metricool (instagram)", updatedAt: new Date().toISOString() },
  handle: file.meta.sample ? "@theclearcode_" : file.handle,
  daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-180),
  reels: allReels,
};
await write("analytics", out);
console.log(`saved ${out.daily.length} days (${out.daily[0]?.date ?? "—"} → ${out.daily.at(-1)?.date ?? "—"}) and ${allReels.length} reels`);

const needNotes = scoreReels(allReels).filter((h) => isHeater(h) && !h.reel.note);
if (needNotes.length) {
  console.log(`\nheaters that need a one-line "what made it pop" note (write it into data/analytics.json → reels[].note):`);
  for (const h of needNotes) console.log(`- ${h.reel.id} “${h.reel.title}”\n  ${heaterStats(h, allReels)}`);
} else {
  console.log("no heaters need notes.");
}
