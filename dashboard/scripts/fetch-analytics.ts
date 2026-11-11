/**
 * Daily Instagram pull (05:30 via scripts/install-schedule.sh) → data/analytics.json.
 *
 *   npm run analytics:fetch
 *
 * Instagram Graph API (Instagram professional account):
 *  - account totals per day: GET /{ig-user-id}/insights metric=views,saves,follows_and_unfollows
 *    metric_type=total_value, one call per day (since/until), backfilling up to 180
 *    days on the first run (Instagram may refuse older days — the backfill stops there)
 *  - DM volume: GET /{ig-user-id}/conversations?platform=instagram — conversations
 *    whose last activity fell on each day (needs instagram_manage_messages; skipped without it)
 *  - reels: GET /{ig-user-id}/media (last 90 days, media_product_type=REELS) and
 *    GET /{media-id}/insights metric=views,saved,shares,follows,comments
 * Then Claude writes the one-line "what made it pop" note for each new heater.
 *
 * Env: IG_USER_ID, IG_ACCESS_TOKEN (instagram_basic, instagram_manage_insights,
 * optional instagram_manage_messages), IG_GRAPH_VERSION (default v23.0),
 * ANTHROPIC_API_KEY (optional, for notes).
 *
 * NOTE: written against Meta's documented endpoints but not yet run against a
 * live account. Metric names change between Graph API versions — if a metric
 * errors, the script logs it and records 0 rather than failing the whole pull.
 */
import { read, write } from "../lib/store.ts";
import { scoreReels, isHeater, heaterStats } from "../lib/analytics.ts";
import { explainHeaters, describeAiError } from "../lib/ai.ts";
import type { AnalyticsFile, DailyMetric, Reel } from "../lib/types.ts";

const USER = process.env.IG_USER_ID;
const TOKEN = process.env.IG_ACCESS_TOKEN;
if (!USER || !TOKEN) {
  console.error("set IG_USER_ID and IG_ACCESS_TOKEN (see CLAUDE.md → connecting instagram)");
  process.exit(1);
}
const BASE = `${process.env.IG_GRAPH_BASE ?? "https://graph.facebook.com"}/${process.env.IG_GRAPH_VERSION ?? "v23.0"}`;
const DAY = 864e5;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path}?${new URLSearchParams({ ...params, access_token: TOKEN! })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json;
}

type TotalValue = { data: { name: string; total_value?: { value: number; breakdowns?: { results: { dimension_values: string[]; value: number }[] }[] } }[] };

async function dayTotals(date: string): Promise<Omit<DailyMetric, "dms">> {
  const since = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const params = { period: "day", metric_type: "total_value", since: String(since), until: String(since + 86400) };
  const out = { date, views: 0, saves: 0, follows: 0 };
  const main = await get<TotalValue>(`/${USER}/insights`, { ...params, metric: "views,saves" });
  for (const m of main.data) {
    if (m.name === "views") out.views = m.total_value?.value ?? 0;
    if (m.name === "saves") out.saves = m.total_value?.value ?? 0;
  }
  try {
    const f = await get<TotalValue>(`/${USER}/insights`, { ...params, metric: "follows_and_unfollows", breakdown: "follow_type" });
    const results = f.data[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    out.follows = results.find((r) => r.dimension_values.includes("FOLLOWER"))?.value ?? 0;
  } catch (e) {
    console.warn(`  follows ${date}: ${(e as Error).message}`);
  }
  return out;
}

async function dmActivity(sinceMs: number): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  try {
    let page: { data: { updated_time: string }[]; paging?: { next?: string } } | null = await get(`/${USER}/conversations`, {
      platform: "instagram",
      fields: "updated_time",
      limit: "100",
    });
    while (page) {
      for (const c of page.data) {
        if (new Date(c.updated_time).getTime() < sinceMs) return counts;
        const d = c.updated_time.slice(0, 10);
        counts.set(d, (counts.get(d) ?? 0) + 1);
      }
      page = page.paging?.next ? await get(page.paging.next) : null;
    }
  } catch (e) {
    console.warn(`dm volume skipped: ${(e as Error).message}`);
  }
  return counts;
}

type Media = { id: string; caption?: string; timestamp: string; permalink?: string; media_product_type?: string };

async function recentReels(sinceMs: number): Promise<Media[]> {
  const out: Media[] = [];
  let page: { data: Media[]; paging?: { next?: string } } | null = await get(`/${USER}/media`, {
    fields: "id,caption,timestamp,permalink,media_product_type",
    limit: "50",
  });
  while (page) {
    for (const m of page.data) {
      if (new Date(m.timestamp).getTime() < sinceMs) return out;
      if (m.media_product_type === "REELS") out.push(m);
    }
    page = page.paging?.next ? await get(page.paging.next) : null;
  }
  return out;
}

async function reelInsights(id: string) {
  const want = ["views", "saved", "shares", "follows", "comments"];
  const values: Record<string, number> = {};
  const parse = (r: { data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }) => {
    for (const m of r.data) values[m.name] = m.total_value?.value ?? m.values?.[0]?.value ?? 0;
  };
  try {
    parse(await get(`/${id}/insights`, { metric: want.join(",") }));
  } catch {
    // one unsupported metric fails the batch — ask one at a time
    for (const metric of want) {
      try {
        parse(await get(`/${id}/insights`, { metric }));
      } catch (e) {
        console.warn(`  ${id} ${metric}: ${(e as Error).message}`);
      }
    }
  }
  return values;
}

const file: AnalyticsFile = await read("analytics");
const fresh = file.meta.sample || file.daily.length === 0;
const keep = new Map((fresh ? [] : file.daily).map((d) => [d.date, d]));
const today = new Date();
const yesterday = new Date(today.getTime() - DAY);

// days to (re)fetch: yesterday and the day before always (late-arriving numbers), plus any gap
const days: string[] = [];
for (let i = 1; i <= (fresh ? 180 : 60); i++) {
  const d = ymd(new Date(today.getTime() - i * DAY));
  if (i <= 2 || !keep.has(d)) days.push(d);
}

console.log(`fetching ${days.length} days of account insights…`);
const dms = await dmActivity(new Date(today.getTime() - 181 * DAY).getTime());
for (const date of days) {
  try {
    keep.set(date, { ...(await dayTotals(date)), dms: dms.get(date) ?? 0 });
  } catch (e) {
    console.warn(`  stopping backfill at ${date}: ${(e as Error).message}`);
    break; // older than Instagram will give us
  }
}

console.log("fetching reels…");
const media = await recentReels(today.getTime() - 90 * DAY);
const oldNotes = new Map(file.reels.map((r) => [r.id, r.note]));
const reels: Reel[] = [];
for (const m of media) {
  const v = await reelInsights(m.id);
  const firstLine = (m.caption ?? "").split("\n")[0].trim();
  reels.push({
    id: m.id,
    title: firstLine.slice(0, 80) || "(no caption)",
    hook: firstLine.split(/(?<=[.!?])\s/)[0] || firstLine,
    postedAt: m.timestamp,
    views: v.views ?? 0,
    saves: v.saved ?? 0,
    shares: v.shares ?? 0,
    follows: v.follows ?? 0,
    comments: v.comments ?? 0,
    url: m.permalink,
    note: fresh ? undefined : oldNotes.get(m.id),
  });
}

// one-line notes for heaters that don't have one yet
const needNotes = scoreReels(reels).filter((h) => isHeater(h) && !h.reel.note);
if (needNotes.length) {
  try {
    const notes = await explainHeaters(needNotes.map((h) => ({ id: h.reel.id, hook: h.reel.hook, title: h.reel.title, stats: heaterStats(h, reels) })));
    for (const r of reels) if (notes.has(r.id)) r.note = notes.get(r.id);
    console.log(`claude wrote ${notes.size} heater notes`);
  } catch (e) {
    console.warn(`heater notes: ${describeAiError(e)} (the page falls back to rule-based notes)`);
  }
}

const out: AnalyticsFile = {
  meta: { sample: false, source: "instagram graph api", updatedAt: new Date().toISOString() },
  handle: file.handle,
  daily: [...keep.values()].filter((d) => d.date <= ymd(yesterday)).sort((a, b) => a.date.localeCompare(b.date)).slice(-180),
  reels,
};
await write("analytics", out);
console.log(`saved ${out.daily.length} days and ${reels.length} reels`);
