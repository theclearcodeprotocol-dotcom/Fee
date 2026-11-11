/**
 * Rule-based tagging for news items (What's trending). Claude does the tagging
 * when an API key is set (scripts/fetch-trending.ts); these rules are the
 * fallback and also produce the 0–100 score shown on every card.
 *
 * Dependency-free: imported by the Next.js app and by scripts under plain Node.
 *
 * Score from four signals a short-form hook needs:
 *  - stakes:   money, jobs, safety, "free", "banned" — viewers feel it personally
 *  - novelty:  launch / first / new / leaked — a reason to watch *today*
 *  - names:    big recognisable brands and models — instant context in 1 second
 *  - shape:    numbers and versus/comparisons — easy to frame as a list or a fight
 * Recency adds up to 15 points.
 *
 * Tags: score >= 35 → "hook potential"; otherwise "explainer" if it teaches a
 * concept people search for (how / why / research / guide…); else "skip".
 */

import type { TrendItem, TrendTag } from "./types.ts";

const STAKES = ["free", "tricked", "hidden", "cut", "raises", "jobs", "job", "salary", "money", "price", "cheaper", "banned", "ban", "lawsuit", "sued", "privacy", "scam", "replace", "replaces", "layoffs", "safety", "leak", "leaked", "killed", "kills"];
const NOVELTY = ["launch", "launches", "launched", "new", "first", "announces", "unveils", "release", "releases", "just", "open-source", "open source", "beta", "now", "adds", "ships", "unveil", "demos", "tests", "can now"];
const NAMES = ["openai", "chatgpt", "anthropic", "claude", "google", "gemini", "meta", "llama", "apple", "microsoft", "nvidia", "deepmind", "mistral", "xai", "grok", "tiktok", "instagram", "youtube"];
const EXPLAINER = /\b(how|why|what is|what are|explained|guide|study|research|report|researchers|survey|course|lessons?|compared|review|benchmarks?)\b/i;
const SHAPE = /\b\d+(\.\d+)?(x|%|k|m|b)?\b|\bvs\.?\b|\bversus\b|\bbeats?\b/i;

export const HOOK_THRESHOLD = 35;

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hits(text: string, words: string[]) {
  return words.reduce((n, w) => (new RegExp(`\\b${escape(w)}\\b`, "i").test(text) ? n + 1 : n), 0);
}

export function scoreHookPotential(title: string, summary: string, publishedAt: string, now: Date): number {
  const text = `${title} ${summary}`;
  let score = 0;
  score += Math.min(hits(text, STAKES), 2) * 15;
  score += Math.min(hits(text, NOVELTY), 2) * 10;
  score += Math.min(hits(text, NAMES), 2) * 10;
  score += SHAPE.test(title) ? 10 : 0;
  score += /\$\d/.test(text) ? 10 : 0; // money figures
  const ageHours = (now.getTime() - new Date(publishedAt).getTime()) / 36e5;
  score += ageHours <= 24 ? 15 : ageHours <= 72 ? 8 : 0;
  return Math.max(0, Math.min(100, score));
}

export function ruleTag(title: string, summary: string, score: number): { tag: TrendTag; reason: string } {
  const text = `${title} ${summary}`;
  if (score >= HOOK_THRESHOLD) {
    const why = [
      hits(text, STAKES) ? "personal stakes" : "",
      hits(text, NAMES) ? "a name people know" : "",
      hits(text, NOVELTY) ? "brand-new" : "",
      SHAPE.test(title) ? "a number to hook on" : "",
    ].filter(Boolean);
    return { tag: "hook potential", reason: why.length ? why.slice(0, 2).join(" + ") : "high rule score" };
  }
  if (EXPLAINER.test(text)) return { tag: "explainer", reason: "teaches a concept — better as a slower explainer than a hook" };
  return { tag: "skip", reason: "no stakes, names or news angle for a general audience" };
}

/** Turn a headline into a first line you could say to camera. */
export function hookIdeaFor(title: string): string {
  const t = title.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  const lower = t.charAt(0).toLowerCase() + t.slice(1);
  if (/\b(free tier|for free|cheaper|price cut|prices?)\b/i.test(t)) return `this just got way cheaper — and nobody's talking about it: ${lower}.`;
  if (/\b(jobs?|replace[sd]?|layoffs)\b/i.test(t)) return `if your job touches a screen, watch this: ${lower}.`;
  if (/\b(vs\.?|versus|beats?)\b/i.test(t)) return `i tested it so you don't have to — ${lower}.`;
  if (/\b(launch(es|ed)?|releases?|unveils|announces)\b/i.test(t)) return `this dropped today and it changes how you'll work: ${lower}.`;
  return `here's the clear version of today's ai news: ${lower}.`;
}

/** The feed's top section and the 7am Slack digest: the 5 newest items tagged "hook potential". */
export function topHookItems(items: TrendItem[], n = 5): TrendItem[] {
  return items
    .filter((i) => i.tag === "hook potential")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, n);
}
