/**
 * Analytics maths. Pure functions over AnalyticsFile; no clock reads — "today"
 * is the last day in the file.
 *
 * Heater rule: a reel is a heater when its views are at least 2× the median
 * views of your reels posted in the 30 days before it went up (its own 30-day
 * median at the time). With fewer than 3 reels in that window it falls back to
 * the median of every earlier reel.
 */
import type { AnalyticsFile, DailyMetric, Reel } from "./types.ts";

export const HEATER_MULTIPLE = 2;
export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export type MetricKey = "views" | "saves" | "follows" | "dms" | "likes" | "shares";

const DAY = 864e5;

export function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function metricSummary(daily: DailyMetric[], key: MetricKey, days: Range) {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted.slice(-days);
  const previous = sorted.slice(-days * 2, -days);
  const total = current.reduce((n, d) => n + (d[key] ?? 0), 0);
  const prevTotal = previous.reduce((n, d) => n + (d[key] ?? 0), 0);
  return {
    /** false when the source doesn't provide this metric at all (e.g. DMs via Metricool) */
    available: sorted.some((d) => d[key] !== undefined),
    days: current.length,
    total,
    // only compare against a full previous period
    change: previous.length === days && prevTotal > 0 ? (total - prevTotal) / prevTotal : null,
    series: current.map((d) => ({ date: d.date, value: d[key] ?? 0 })),
  };
}

export interface HeaterInfo {
  reel: Reel;
  /** null when there are no earlier reels to compare against */
  baseline: number | null;
  multiple: number | null;
}

/** 30-day median baseline and multiple for every reel. */
export function scoreReels(reels: Reel[]): HeaterInfo[] {
  const sorted = [...reels].sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  return sorted.flatMap((reel, i): HeaterInfo[] => {
    const t = new Date(reel.postedAt).getTime();
    const earlier = sorted.slice(0, i);
    const window = earlier.filter((r) => t - new Date(r.postedAt).getTime() <= 30 * DAY);
    const pool = window.length >= 3 ? window : earlier;
    if (!pool.length) return [{ reel, baseline: null, multiple: null }];
    const baseline = median(pool.map((r) => r.views));
    return [{ reel, baseline, multiple: baseline > 0 ? reel.views / baseline : null }];
  });
}

export function reelsInRange(file: AnalyticsFile, days: Range) {
  const last = [...file.daily].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;
  if (!last) return [];
  const start = new Date(`${last}T00:00:00Z`).getTime() - (days - 1) * DAY;
  return scoreReels(file.reels).filter((h) => new Date(h.reel.postedAt).getTime() >= start);
}

export const isHeater = (h: HeaterInfo) => h.multiple !== null && h.multiple >= HEATER_MULTIPLE;

/** Top 5 heaters in the range, sorted by view count. */
export function topHeaters(file: AnalyticsFile, days: Range, n = 5) {
  return reelsInRange(file, days)
    .filter(isHeater)
    .sort((a, b) => b.reel.views - a.reel.views)
    .slice(0, n);
}

/* ---------------- "what made it pop" ---------------- */

const RATES = [
  { key: "saves", label: "saved", clause: (x: string) => `saved ${x}× more than usual — a reference people wanted to keep` },
  { key: "shares", label: "shared", clause: (x: string) => `shared ${x}× more than usual — people sent it to friends` },
  { key: "follows", label: "follows", clause: (x: string) => `${x}× your usual follow rate — it promised more where that came from` },
  { key: "comments", label: "comments", clause: (x: string) => `${x}× the usual comments — the hook started a conversation` },
] as const;

function hookClause(hook: string) {
  const h = hook.toLowerCase();
  if (/\bjust (killed|replaced|ended)\b/.test(h)) return "a news-style “[x] just killed [y]” opener";
  if (/^stop\b/.test(h)) return "a contrarian “stop doing [x]” opener";
  if (/things i wish i knew/.test(h)) return "a “things i wish i knew” list opener";
  if (/^\d|\b\d+\b/.test(h.split(".")[0])) return "a number in the first line";
  if (/\?$/.test(h.split(".")[0]) || h.includes("?")) return "a question viewers wanted answered";
  if (/^(i |i've|i haven't)/.test(h)) return "a first-person result up front";
  return "a curiosity-gap opener";
}

/** One line on why a heater popped, from rates vs your medians. Claude can overwrite it (reel.note). */
export function popNote(reel: Reel, all: Reel[]): string {
  if (reel.note) return reel.note;
  const hook = hookClause(reel.hook);
  // a hook that held: far fewer people swiped away in the first 3 seconds (Metricool's skip rate)
  const skips = all.flatMap((r) => (r.skipRate !== undefined ? [r.skipRate] : []));
  if (reel.skipRate !== undefined && skips.length >= 3 && reel.skipRate <= median(skips) * 0.8) {
    return `only ${reel.skipRate.toFixed(0)}% swiped away in the first 3s (you usually lose ${median(skips).toFixed(0)}%) — ${hook} held them.`;
  }
  // TikTok: a video people watched to the end far more than usual
  const full = all.flatMap((r) => (r.fullWatchRate !== undefined ? [r.fullWatchRate] : []));
  if (reel.fullWatchRate !== undefined && full.length >= 3 && reel.fullWatchRate >= median(full) * 1.3) {
    return `${reel.fullWatchRate.toFixed(0)}% watched to the end (you usually get ${median(full).toFixed(0)}%) — ${hook} kept them to the last second.`;
  }
  const rate = (r: Reel, k: (typeof RATES)[number]["key"]) => r[k] / Math.max(1, r.views);
  const ratios = RATES
    // skip rates the source doesn't report (Metricool has no per-reel follows)
    .filter((m) => all.some((r) => r[m.key] > 0))
    .map((m) => ({ m, ratio: rate(reel, m.key) / Math.max(1e-9, median(all.map((r) => rate(r, m.key)))) }))
    .sort((a, b) => b.ratio - a.ratio);
  const best = ratios[0];
  if (best && best.ratio >= 1.3) return `${best.m.clause(best.ratio.toFixed(1))}; ${hook}.`;
  return `pure reach — ${hook} got it pushed past your followers.`;
}

export function heaterStats(h: HeaterInfo, all: Reel[]) {
  const r = h.reel;
  const pct = (n: number) => `${((n / r.views) * 100).toFixed(2)}%`;
  const med = (k: "saves" | "shares" | "follows" | "comments") => `${((median(all.map((x) => x[k] / x.views)) || 0) * 100).toFixed(2)}%`;
  const full = r.fullWatchRate !== undefined ? `; watched to the end ${r.fullWatchRate}% vs median ${median(all.flatMap((x) => (x.fullWatchRate !== undefined ? [x.fullWatchRate] : []))).toFixed(1)}%` : "";
  const fy = r.forYouRate !== undefined ? `; ${r.forYouRate}% of views from For You` : "";
  const skip = r.skipRate !== undefined ? `; skip rate (swiped away in 3s) ${r.skipRate}% vs median ${median(all.flatMap((x) => (x.skipRate !== undefined ? [x.skipRate] : []))).toFixed(1)}%` : "";
  // only the rates this platform actually reports (TikTok has no saves or per-video follows)
  const rates = (["saves", "shares", "follows", "comments"] as const)
    .filter((k) => all.some((x) => x[k] > 0))
    .map((k) => `${k.slice(0, -1)} rate ${pct(r[k])} vs median ${med(k)}`)
    .join("; ");
  return `views ${r.views} (${h.multiple?.toFixed(1) ?? "?"}× 30-day median)${skip}${full}${fy}${rates ? `; ${rates}` : ""}`;
}
