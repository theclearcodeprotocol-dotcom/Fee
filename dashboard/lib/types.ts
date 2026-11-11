/**
 * Shared data shapes. Each JSON file in /data matches one of these, and every
 * writer (seed script, /script command, scrapers, API routes) must keep to them.
 */

export type Platform = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";

export const PLATFORMS: { id: Platform; label: string; captionLimit: number }[] = [
  { id: "instagram", label: "Instagram Reels", captionLimit: 2200 },
  { id: "tiktok", label: "TikTok", captionLimit: 2200 },
  { id: "youtube", label: "YouTube Shorts", captionLimit: 100 }, // Shorts title
  { id: "linkedin", label: "LinkedIn", captionLimit: 3000 },
  { id: "x", label: "X", captionLimit: 280 },
];

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
  | "callout";

export interface Hook {
  id: string;
  /** Exactly what was said in the first ~3 seconds (ElevenLabs transcript) */
  transcript: string;
  /** Reusable version with [placeholders] */
  template: string;
  format: HookFormat;
  creator: string; // @handle
  platform: Platform;
  url?: string;
  views?: number;
  savedAt: string; // ISO
  tags: string[];
}

/* ---------------- Analytics ---------------- */

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  views: number;
  saves: number;
  follows: number;
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
  url?: string;
}

export interface AnalyticsFile {
  meta: DataMeta;
  handle: string;
  daily: DailyMetric[];
  reels: Reel[];
}

/* ---------------- Competitive tracker ---------------- */

export interface TrackedCreator {
  handle: string;
  name: string;
  niche: string;
  followers: number;
  /** median views over their last 30 reels; used for the outlier multiple */
  medianViews: number;
}

export interface CompetitorReel {
  id: string;
  creator: string; // handle
  hook: string;
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

/* ---------------- Scheduler ---------------- */

export type PostStatus = "scheduled" | "published" | "failed";

export interface ScheduledPost {
  id: string;
  title: string;
  brief: string;
  scheduledFor: string; // ISO
  platforms: Platform[];
  captions: Partial<Record<Platform, string>>;
  status: PostStatus;
  createdAt: string;
}

/* ---------------- Content calendar ---------------- */

export type CalendarStatus = "idea" | "scripted" | "filmed" | "edited" | "posted";

export interface CalendarEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  hook: string;
  angle: string;
  platforms: Platform[];
  status: CalendarStatus;
  /** "script" when written by the /script command, "manual" otherwise */
  source: "script" | "manual";
  scriptPath?: string;
}

/* ---------------- Trending ---------------- */

export type HookPotential = "high" | "medium" | "low";

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
  potential: HookPotential;
  /** 0–100, see lib/hook-potential.ts */
  score: number;
  /** A ready-to-film opening line */
  hookIdea: string;
  tags: string[];
}

export interface TrendingFile {
  meta: DataMeta;
  sources: TrendSource[];
  items: TrendItem[];
}
