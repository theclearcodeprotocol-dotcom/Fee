/**
 * Shared data shapes. Each JSON file in /data matches one of these, and every
 * writer (seed script, /script skill, scheduled jobs, API routes) must keep to them.
 *
 * Plain types only — scripts under plain Node import this file.
 */

export type Platform = "instagram" | "tiktok";

export const PLATFORMS: { id: Platform; label: string; captionLimit: number }[] = [
  { id: "instagram", label: "Instagram", captionLimit: 2200 },
  { id: "tiktok", label: "TikTok", captionLimit: 2200 },
];

export type PostFormat = "reel" | "carousel";

/** Meta block on every data file, so the UI can say where numbers came from. */
export interface DataMeta {
  /** true while the file holds generated sample data rather than a real pull */
  sample: boolean;
  source: string;
  updatedAt: string; // ISO
}

/* ---------------- Hook vault ---------------- */

export type HookFormat =
  | "curiosity"
  | "contrarian"
  | "listicle"
  | "story"
  | "pov"
  | "how-to"
  | "result-first"
  | "callout"
  | "news";

export interface Hook {
  id: string;
  /** Exactly what was said in the opening seconds (ElevenLabs transcript) */
  transcript: string;
  /** Reusable version with [placeholders], e.g. "stop doing [x]" */
  template: string;
  format: HookFormat;
  niche: string;
  creator: string; // @handle
  platform: Platform;
  url?: string;
  views?: number;
  /** on-screen text from the first seconds, when it came from a scraped reel */
  onScreenText?: string;
  /** id of the competitor reel it was saved from */
  sourceReelId?: string;
  savedAt: string; // ISO
}

/** Hooks queued for /script by the "use this" button. /script takes the oldest. */
export interface ScriptQueueItem {
  hookId: string;
  template: string;
  transcript: string;
  niche: string;
  queuedAt: string;
}

/* ---------------- Analytics ---------------- */

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  views: number;
  saves: number;
  follows: number;
  /** DM conversations with activity that day — only from the direct Instagram API; Metricool has no DM data */
  dms?: number;
}

export interface Reel {
  id: string;
  title: string;
  hook: string;
  postedAt: string; // ISO
  views: number;
  saves: number;
  shares: number;
  follows: number;
  comments: number;
  reach?: number;
  /** average % of the reel watched (Metricool) */
  retention?: number;
  /** % who swiped away in the first 3 seconds (Metricool) */
  skipRate?: number;
  url?: string;
  /** one-line "why it popped", written by Claude during the analytics pull */
  note?: string;
}

export interface AnalyticsFile {
  meta: DataMeta;
  handle: string;
  daily: DailyMetric[];
  reels: Reel[];
}

/* ---------------- Competitor tracker ---------------- */

export interface TrackedCreator {
  handle: string;
  name: string;
  niche: string;
  followers: number;
}

export interface CompetitorReel {
  id: string;
  creator: string; // handle
  /** first spoken sentence */
  hook: string;
  /** text burned into the first frames, read by Claude vision */
  onScreenText: string;
  /** opening ~15 seconds of speech (ElevenLabs) */
  transcript: string;
  caption: string;
  views: number;
  likes: number;
  comments: number;
  postedAt: string;
  url?: string;
}

export interface CompetitorsFile {
  meta: DataMeta;
  creators: TrackedCreator[];
  reels: CompetitorReel[];
}

/* ---------------- Content calendar ---------------- */

export type CalendarStatus = "idea" | "scripted" | "filmed" | "edited" | "scheduled" | "posted";

export interface CalendarEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM, local time of the creator
  title: string;
  format: PostFormat;
  platforms: Platform[];
  hook: string;
  angle: string;
  cta: string;
  status: CalendarStatus;
  /** "script" when written by the /script skill, "manual" otherwise */
  source: "script" | "manual";
  /** repo-relative path of the script file, e.g. content/scripts/2026-11-20-x.md */
  scriptPath?: string;
  /** inline script, used when there is no file (sample data, quick manual posts) */
  script?: string;
}

/* ---------------- Scheduler ---------------- */

/**
 * pending_approval → approved → in_metricool (Metricool publishes it at the time)
 * (direct-API route instead: approved → publishing → published | failed)
 * Nothing is ever sent to a platform unless status is "approved" and the
 * captions/media are unchanged since approval (see approvalKey in lib/posts.ts).
 */
export type PostStatus = "pending_approval" | "approved" | "in_metricool" | "publishing" | "published" | "failed";

export interface PublishResult {
  ok: boolean;
  at: string;
  id?: string;
  /** Metricool planner link for the scheduled post */
  url?: string;
  error?: string;
}

export interface ScheduledPost {
  id: string;
  calendarEntryId: string;
  title: string;
  format: PostFormat;
  platforms: Platform[];
  scheduledFor: string; // ISO instant
  captions: Partial<Record<Platform, string>>;
  /** public URLs: one video for a reel, 2–10 images for a carousel */
  media: string[];
  status: PostStatus;
  captionSource: "claude" | "template" | "edited";
  createdAt: string;
  approvedAt?: string;
  /** fingerprint of captions + media + time at approval */
  approvalKey?: string;
  results?: Partial<Record<Platform, PublishResult>>;
}

/* ---------------- Trending ---------------- */

export type TrendTag = "hook potential" | "explainer" | "skip";

export interface TrendSource {
  id: string;
  name: string;
  url: string; // RSS / feed URL
}

export interface TrendItem {
  id: string;
  sourceId: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  tag: TrendTag;
  /** one line on why it got that tag */
  reason: string;
  /** 0–100 rule score, see lib/hook-potential.ts */
  score: number;
  /** a ready-to-say first line */
  hookIdea: string;
  taggedBy: "claude" | "rules";
}

export interface TrendingFile {
  meta: DataMeta;
  sources: TrendSource[];
  items: TrendItem[];
}
