/**
 * Hook-potential scoring for news items (What's trending page).
 *
 * Dependency-free on purpose: it is imported both by the Next.js app and by
 * `scripts/fetch-trending.ts`, which runs under plain Node (type stripping).
 *
 * Score 0–100 from four signals a short-form hook needs:
 *  - stakes:   money, jobs, safety, "free", "banned" — viewers feel it personally
 *  - novelty:  launch / first / new / leaked — a reason to watch *today*
 *  - names:    big recognisable brands and models — instant context in 1 second
 *  - shape:    numbers and versus/comparisons — easy to frame as a list or a fight
 * Recency adds up to 15 points. >= 45 is "high", >= 25 "medium", else "low".
 */

import type { HookPotential } from "./types.ts";

const STAKES = ["free", "tricked", "hidden", "cut", "raises", "jobs", "job", "salary", "money", "price", "cheaper", "banned", "ban", "lawsuit", "sued", "privacy", "scam", "replace", "replaces", "layoffs", "safety", "leak", "leaked"];
const NOVELTY = ["launch", "launches", "launched", "new", "first", "announces", "unveils", "release", "releases", "just", "open-source", "open source", "beta", "now", "adds", "ships", "unveil", "demos", "tests", "can now"];
const NAMES = ["openai", "chatgpt", "anthropic", "claude", "google", "gemini", "meta", "llama", "apple", "microsoft", "nvidia", "deepmind", "mistral", "xai", "grok", "tiktok", "instagram", "youtube"];
const SHAPE = /\b\d+(\.\d+)?\s?(x|%|k|m|b|billion|million)?\b|\bvs\.?\b|\bversus\b|\bbeats?\b/i;

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

export function potentialFromScore(score: number): HookPotential {
  if (score >= 45) return "high";
  if (score >= 25) return "medium";
  return "low";
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
