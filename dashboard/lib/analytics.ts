import type { AnalyticsFile, DailyMetric, Reel } from "./types";

/**
 * "Heater" — a reel posted in the last 7 days whose views are at least 2× the
 * median of all reels in the file (≈ the trailing 30 days). Ranked by a heat
 * score that rewards saves and follows, not just reach:
 *   heat = views / median × (1 + 10 × save rate + 50 × follow rate)
 * Decision: saves and follows weigh most because they predict reach on the
 * next post better than raw views do.
 */
export const HEATER_MULTIPLE = 2;

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const sum = (rows: DailyMetric[], key: keyof Omit<DailyMetric, "date">) => rows.reduce((n, r) => n + r[key], 0);

export function summarise(file: AnalyticsFile) {
  const daily = [...file.daily].sort((a, b) => a.date.localeCompare(b.date));
  const last = daily.at(-1)!;
  const thisWeek = daily.slice(-7);
  const prevWeek = daily.slice(-14, -7);
  const kpi = (key: "views" | "saves" | "follows") => {
    const now = sum(thisWeek, key);
    const before = sum(prevWeek, key);
    return { value: now, change: before ? (now - before) / before : 0 };
  };
  const views = kpi("views");
  const saves = kpi("saves");
  const prevSaveRate = sum(prevWeek, "saves") / Math.max(1, sum(prevWeek, "views"));
  const saveRate = saves.value / Math.max(1, views.value);

  const med = median(file.reels.map((r) => r.views));
  const weekStart = new Date(`${last.date}T00:00:00Z`).getTime() - 6 * 864e5;
  const heaters = file.reels
    .filter((r) => new Date(r.postedAt).getTime() >= weekStart && r.views >= HEATER_MULTIPLE * med)
    .map((r) => ({ ...r, multiple: r.views / med, heat: heat(r, med) }))
    .sort((a, b) => b.heat - a.heat);

  return {
    asOf: last.date,
    kpis: {
      views,
      saves,
      follows: kpi("follows"),
      saveRate: { value: saveRate, change: prevSaveRate ? (saveRate - prevSaveRate) / prevSaveRate : 0 },
    },
    daily,
    heaters,
    medianViews: med,
    topReels: [...file.reels].sort((a, b) => heat(b, med) - heat(a, med)).slice(0, 8).map((r) => ({ ...r, multiple: r.views / med })),
  };
}

function heat(r: Reel, med: number) {
  return (r.views / med) * (1 + 10 * (r.saves / r.views) + 50 * (r.follows / r.views));
}
