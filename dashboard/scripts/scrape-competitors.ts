/**
 * Weekly competitor scrape → data/competitors.json. Scheduled for Sunday 06:00
 * by scripts/install-schedule.sh.
 *
 *   npm run scrape:competitors
 *
 * For each tracked account (data/competitors.json → creators, edit that list):
 *   1. Apify "Instagram Reel Scraper" pulls their recent reels; Apify
 *      "Instagram Profile Scraper" refreshes follower counts.
 *   2. Keep the top 5 by views among reels posted in the last 7 days, topped
 *      up from the last 30 days if they posted fewer than 5 that week.
 *   3. Each reel is downloaded; ElevenLabs transcribes its first 15 seconds and
 *      the first spoken sentence becomes the hook; Claude reads the on-screen
 *      text from frames at 0.4s / 1.2s / 2.5s.
 *
 * Env: APIFY_TOKEN (required), ELEVENLABS_API_KEY, ANTHROPIC_API_KEY. Needs ffmpeg.
 *
 * Decision: Instagram has no API for other people's reels, so this uses Apify
 * actors (pay per result). The field names in toReel()/followers follow the
 * actors' documented output; the raw responses are saved to
 * data/competitors.raw.json — check one run and adjust if an actor changes.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { download, framesAt, hookFromWords, transcribeOpening, withTempDir } from "../lib/media.ts";
import { readOnScreenText } from "../lib/ai.ts";
import type { CompetitorReel, CompetitorsFile } from "../lib/types.ts";

const DATA = join(process.cwd(), "data", "competitors.json");
const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error("set APIFY_TOKEN (https://console.apify.com/account/integrations)");
  process.exit(1);
}
const REEL_ACTOR = process.env.APIFY_REEL_ACTOR ?? "apify~instagram-reel-scraper";
const PROFILE_ACTOR = process.env.APIFY_PROFILE_ACTOR ?? "apify~instagram-profile-scraper";
const TOP_N = 5;

async function runActor(actor: string, input: unknown): Promise<Record<string, unknown>[]> {
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!res.ok) throw new Error(`Apify ${actor} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as Record<string, unknown>[];
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

const file = JSON.parse(await readFile(DATA, "utf8")) as CompetitorsFile;
const usernames = file.creators.map((c) => c.handle.replace(/^@/, ""));
console.log(`scraping ${usernames.length} accounts…`);

const [rawReels, rawProfiles] = await Promise.all([
  runActor(REEL_ACTOR, { username: usernames, resultsLimit: 30 }),
  runActor(PROFILE_ACTOR, { usernames }).catch((e) => {
    console.warn(`follower refresh skipped: ${e.message}`);
    return [];
  }),
]);
await writeFile(DATA.replace(".json", ".raw.json"), JSON.stringify({ reels: rawReels, profiles: rawProfiles }, null, 2));

for (const p of rawProfiles) {
  const c = file.creators.find((c) => c.handle === `@${str(p.username)}`);
  if (c && num(p.followersCount)) c.followers = num(p.followersCount);
}

type Candidate = Omit<CompetitorReel, "hook" | "onScreenText" | "transcript"> & { videoUrl: string };
const candidates: Candidate[] = rawReels.map((item, i) => ({
  id: str(item.shortCode) || str(item.id) || `reel_${i}`,
  creator: `@${str(item.ownerUsername)}`,
  caption: str(item.caption),
  views: num(item.videoPlayCount) || num(item.videoViewCount),
  likes: num(item.likesCount),
  comments: num(item.commentsCount),
  postedAt: str(item.timestamp) || new Date().toISOString(),
  url: str(item.url) || undefined,
  videoUrl: str(item.videoUrl),
}));

const now = Date.now();
const age = (r: Candidate) => (now - new Date(r.postedAt).getTime()) / 864e5;
const picked = file.creators.flatMap((c) => {
  const mine = candidates.filter((r) => r.creator === c.handle).sort((a, b) => b.views - a.views);
  const week = mine.filter((r) => age(r) <= 7);
  const month = mine.filter((r) => age(r) > 7 && age(r) <= 30);
  return [...week, ...month].slice(0, TOP_N);
});

const reels: CompetitorReel[] = [];
for (const r of picked) {
  const { videoUrl, ...rest } = r;
  let transcript = "";
  let hook = "";
  let onScreenText = "";
  if (videoUrl) {
    try {
      await withTempDir(async (dir) => {
        const video = join(dir, "reel.mp4");
        await download(videoUrl, video);
        const t = await transcribeOpening(video);
        transcript = t.text;
        hook = hookFromWords(t.words, t.text);
        onScreenText = await readOnScreenText(framesAt(video)).catch((e) => {
          console.warn(`  on-screen text failed for ${r.id}: ${e.message}`);
          return "";
        });
      });
    } catch (e) {
      console.warn(`  ${r.creator} ${r.id}: ${(e as Error).message}`);
    }
  }
  // no speech (music-only reels): fall back to on-screen text, then the caption's first line
  hook ||= onScreenText || rest.caption.split("\n")[0].slice(0, 140) || "(no hook found)";
  reels.push({ ...rest, hook, onScreenText, transcript });
  console.log(`  ${r.creator.padEnd(22)} ${String(r.views).padStart(9)}  ${hook.slice(0, 70)}`);
}

file.reels = reels.sort((a, b) => b.views - a.views);
file.meta = { sample: false, source: "weekly scrape (apify + elevenlabs + claude)", updatedAt: new Date().toISOString() };
await writeFile(DATA, JSON.stringify(file, null, 2) + "\n");
console.log(`saved ${reels.length} reels from ${file.creators.length} accounts`);
