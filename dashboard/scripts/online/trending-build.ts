/**
 * `/trending`, step 3: turn the stories Claude gathered into the dashboard's
 * trending/state document.
 *
 *   node scripts/online/trending-build.ts <stories.json> > state.json
 *
 * stories.json: [{ sourceId, title, summary?, url, publishedAt,
 *                  tag?, reason?, hookIdea? }]
 * Claude's own tag/reason/hookIdea are kept; anything missing falls back to the
 * rules in lib/hook-potential.ts. Every item gets the 0–100 rule score.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { TREND_SOURCES } from "../../lib/trend-sources.ts";
import { hookIdeaFor, ruleTag, scoreHookPotential } from "../../lib/hook-potential.ts";

const now = new Date();
const stories = JSON.parse(readFileSync(process.argv[2], "utf8")) as { sourceId: string; title: string; summary?: string; url: string; publishedAt: string; tag?: string; reason?: string; hookIdea?: string }[];
const seen = new Set<string>();
const items = stories
  .filter((s) => s.title && s.url && !seen.has(s.url) && seen.add(s.url))
  .map((s) => {
    const publishedAt = new Date(s.publishedAt || now).toISOString();
    const score = scoreHookPotential(s.title, s.summary ?? "", publishedAt, now);
    const rule = ruleTag(s.title, s.summary ?? "", score);
    const claude = ["hook potential", "explainer", "skip"].includes(s.tag ?? "");
    return {
      id: createHash("sha1").update(s.url).digest("hex").slice(0, 12), sourceId: s.sourceId, title: s.title, summary: (s.summary ?? "").slice(0, 280), url: s.url, publishedAt,
      tag: claude ? s.tag : rule.tag, reason: (claude && s.reason) || rule.reason, score, hookIdea: s.hookIdea || hookIdeaFor(s.title), taggedBy: claude ? "claude" : "rules",
    };
  })
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
const used = new Set(items.map((i) => i.sourceId));
process.stdout.write(JSON.stringify({
  meta: { sample: false, source: `/trending — ${used.size} of ${TREND_SOURCES.length} sources had stories`, updatedAt: now.toISOString() },
  sources: TREND_SOURCES.map(({ id, name, url, home }) => ({ id, name, url, home })),
  items,
}));
console.error(`${items.length} stories, ${items.filter((i) => i.tag === "hook potential").length} with hook potential`);
