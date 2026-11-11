/**
 * Writes deterministic SAMPLE data to /data so every page renders before any
 * real source is connected. Every file it writes has meta.sample = true, and
 * the UI shows a "sample data" notice while that is the case.
 *
 *   npm run seed                             # (re)write all data files
 *   npm run seed -- --only=analytics,trending
 *
 * Runs under plain Node (>= 22.18, built-in TypeScript type stripping).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { scoreHookPotential, hookIdeaFor, ruleTag } from "../lib/hook-potential.ts";
import { heuristicTemplate } from "../lib/ai.ts";
import { TREND_SOURCES } from "../lib/trend-sources.ts";
import { approvalKey } from "../lib/posts.ts";
import type {
  AnalyticsFile,
  CalendarEntry,
  CompetitorsFile,
  Hook,
  ScheduledPost,
  TrendingFile,
  TrendItem,
} from "../lib/types.ts";

const DATA_DIR = join(import.meta.dirname, "..", "data");
// Anchor date for the sample world. Nothing here reads the clock.
const TODAY = new Date("2026-11-11T09:00:00Z");
const day = (offset: number) => new Date(TODAY.getTime() + offset * 864e5);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Seeded PRNG (mulberry32): each builder gets its own stream, so --only is stable.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function stream(seed: number) {
  const r = rng(seed);
  return { r, between: (a: number, b: number) => Math.round(a + r() * (b - a)) };
}

const sampleMeta = (source: string) => ({ sample: true, source, updatedAt: TODAY.toISOString() });

/* ---------------- hooks ---------------- */

function hooks(): Hook[] {
  const raw: [string, string, string, number][] = [
    ["ChatGPT just killed Google search.", "@techtok.demo", "ai tools", 3_100_000],
    ["Stop doing your captions by hand.", "@reelschool.demo", "creator tips", 940_000],
    ["5 things I wish I knew before I started posting.", "@reelschool.demo", "creator tips", 1_700_000],
    ["Stop doing skincare research on TikTok.", "@skinsci.demo", "skincare", 620_000],
    ["3 things I wish I knew about retinol.", "@skinsci.demo", "skincare", 2_300_000],
    ["Canva just killed the design brief.", "@nocodenina.demo", "no-code", 480_000],
    ["Nobody is talking about the most useful feature in Claude.", "@founderfiles.demo", "ai tools", 960_000],
    ["3 AI tools that feel illegal to know about.", "@techtok.demo", "ai tools", 2_100_000],
    ["If you're a woman in tech, save this before your next salary review.", "@careercode.demo", "careers", 650_000],
    ["Here's how to make AI write in your voice in under 60 seconds.", "@aidaily.demo", "prompting", 720_000],
    ["Stop using ChatGPT like Google.", "@aidaily.demo", "prompting", 1_240_000],
    ["I replaced 4 apps with one prompt, and I'm never going back.", "@nocodenina.demo", "productivity", 880_000],
    ["POV: you finally understand what an AI agent is.", "@theclearcode", "ai explainers", 410_000],
    ["7 things I wish I knew before quitting my job for content.", "@founderfiles.demo", "creator business", 1_050_000],
  ];
  return raw.map(([transcript, creator, niche, views], i) => {
    const { template, format } = heuristicTemplate(transcript);
    return {
      id: `hook_${String(i + 1).padStart(3, "0")}`,
      transcript,
      template,
      format,
      niche,
      creator,
      platform: i % 3 === 1 ? "tiktok" : "instagram",
      views,
      savedAt: day(-i * 2 - 1).toISOString(),
    } satisfies Hook;
  });
}

/* ---------------- analytics ---------------- */

function analytics(): AnalyticsFile {
  const { r, between } = stream(11);
  const DAYS = 180; // 90-day view + the 90 before it for comparison
  const daily = Array.from({ length: DAYS }, (_, i) => {
    const trend = 0.55 + (i / DAYS) * 0.75; // the account is growing
    const views = Math.round(between(8_000, 13_000) * trend);
    return {
      date: ymd(day(i - (DAYS - 1))),
      views,
      saves: Math.round(views * (0.018 + r() * 0.01)),
      follows: Math.round(views * (0.0022 + r() * 0.0012)),
      dms: Math.round(views * (0.0006 + r() * 0.0006)),
    };
  });
  const titles: [string, string][] = [
    ["what an ai agent actually is", "you've heard 'agent' 100 times this week. here's what it means."],
    ["3 prompts i use every day", "3 prompts i use every single day. steal them."],
    ["claude vs chatgpt for writing", "i gave claude and chatgpt the same brief. one was way better."],
    ["the 60-second voice prompt", "make ai write like you in 60 seconds."],
    ["why your prompts are boring", "this is why your ai answers sound like a robot."],
    ["ai news in 30 seconds", "everything that happened in ai this week, in 30 seconds."],
    ["automate your inbox", "i haven't sorted an email by hand in 3 months."],
    ["the context window, explained", "your ai forgets things. here's why."],
    ["build a website with no code", "i built this site in 11 minutes with zero code."],
    ["ai for your skincare routine", "i asked ai to fix my skincare routine. bye bye, guesswork."],
    ["stop saying please to chatgpt?", "does being polite to ai actually change the answer?"],
    ["my full ai stack 2026", "every ai tool i pay for, and the ones i cancelled."],
    ["make a reel with ai in 5 min", "this whole reel was edited by ai. can you tell?"],
    ["the prompt that writes prompts", "the only prompt you need to memorise."],
    ["is ai coming for your job", "the honest answer to 'will ai take my job'."],
    ["hidden chatgpt settings", "turn this setting on before you use chatgpt again."],
    ["ai just killed the cover letter", "ai just killed the cover letter. here's what replaces it."],
    ["stop doing this in chatgpt", "stop doing this in chatgpt. it's costing you better answers."],
    ["5 things i wish i knew about ai", "5 things i wish i knew before i started using ai."],
    ["the free ai tool nobody uses", "the most useful free ai tool, and nobody's using it."],
    ["ai photo trick for your feed", "this ai photo trick made my feed look expensive."],
    ["what 'tokens' means", "every ai tool charges you in 'tokens'. here's what that means."],
    ["ai meal planner", "i let ai plan my meals for a week."],
    ["your data and ai", "is ai training on your messages? here's how to check."],
    ["notebook ai for students", "students: this ai tool is basically a tutor."],
    ["3 ai apps on my phone", "the 3 ai apps that earned a spot on my home screen."],
    ["deepfake or real?", "one of these videos is fake. can you tell which?"],
    ["ai and your skincare labels", "i let ai read my skincare labels. bye bye, guesswork."],
    ["ai agents book my trips now", "i haven't booked a trip myself in 2 months."],
    ["the one-line prompt fix", "add this one line to every prompt."],
    ["ai voice clone, explained", "i cloned my voice in 30 seconds. here's why that's scary."],
    ["claude for spreadsheets", "i gave claude my messiest spreadsheet."],
    ["chatgpt memory, explained", "chatgpt remembers things about you. here's how to see what."],
    ["ai in 2026 — what changed", "the 3 biggest ai changes this year, explained simply."],
    ["ai just killed the to-do list", "ai just killed my to-do list. this replaced it."],
    ["the prompt i use for hooks", "the exact prompt i use to write hooks."],
  ];
  const heaters = new Set([2, 9, 13, 16, 18, 24, 27, 31, 34]);
  const reels = titles.map(([title, hook], i) => {
    const posted = day(-89 + Math.round((i * 89) / (titles.length - 1)));
    const growth = 0.6 + (i / titles.length) * 0.7;
    const heat = heaters.has(i) ? 2.3 + r() * 3.5 : 0.6 + r() * 0.9;
    const views = Math.round(28_000 * growth * heat);
    const saveBoost = i === 18 || i === 13 || i === 27 ? 2.2 : 1;
    const shareBoost = i === 16 || i === 34 ? 2.5 : 1;
    const followBoost = i === 9 || i === 31 ? 2.4 : 1;
    return {
      id: `reel_${String(i + 1).padStart(3, "0")}`,
      title,
      hook,
      postedAt: posted.toISOString(),
      views,
      saves: Math.round(views * (0.015 + r() * 0.01) * saveBoost),
      shares: Math.round(views * (0.004 + r() * 0.004) * shareBoost),
      follows: Math.round(views * (0.002 + r() * 0.0015) * followBoost),
      comments: Math.round(views * (0.002 + r() * 0.003)),
    };
  });
  return { meta: sampleMeta("sample generator — run `npm run analytics:fetch` with IG_USER_ID + IG_ACCESS_TOKEN"), handle: "@theclearcode", daily, reels };
}

/* ---------------- competitors ---------------- */

function competitors(): CompetitorsFile {
  const { r } = stream(22);
  const creators = [
    { handle: "@techtok.demo", name: "techtok", niche: "ai tools", followers: 412_000, median: 85_000 },
    { handle: "@aidaily.demo", name: "ai daily", niche: "ai news", followers: 268_000, median: 54_000 },
    { handle: "@nocodenina.demo", name: "no-code nina", niche: "no-code", followers: 131_000, median: 31_000 },
    { handle: "@promptlab.demo", name: "prompt lab", niche: "prompting", followers: 590_000, median: 120_000 },
    { handle: "@founderfiles.demo", name: "founder files", niche: "creator business", followers: 98_000, median: 22_000 },
    { handle: "@careercode.demo", name: "career code", niche: "careers", followers: 204_000, median: 40_000 },
    { handle: "@skinsci.demo", name: "skin sci", niche: "skincare", followers: 356_000, median: 70_000 },
    { handle: "@reelschool.demo", name: "reel school", niche: "creator tips", followers: 177_000, median: 36_000 },
  ];
  const bank: [string, string][] = [
    ["Google just killed the ten blue links.", "google just killed search 😳"],
    ["Stop doing your research in ChatGPT.", "stop doing this ❌"],
    ["5 things I wish I knew before using AI at work.", "5 things i wish i knew"],
    ["This prompt saved me 10 hours this week.", "10 hours saved. 1 prompt."],
    ["Nobody is talking about this free AI tool.", "the free tool nobody uses"],
    ["I let an AI agent run my business for a week.", "ai ran my business for 7 days"],
    ["Stop paying for these 4 AI tools.", "cancel these 4 subscriptions"],
    ["AI can now watch your screen. Here's how to use it.", "ai can see your screen now"],
    ["3 AI jobs that didn't exist last year.", "3 new jobs ai created"],
    ["You're using Claude wrong. Do this instead.", "you're using claude wrong"],
    ["Apple just killed the note-taking app.", "apple just killed notes apps"],
    ["The one setting that makes ChatGPT twice as smart.", "turn this on 👇"],
  ];
  const reels = creators.flatMap((c, ci) =>
    Array.from({ length: 5 }, (_, k) => {
      const [hook, onScreen] = bank[(ci * 3 + k) % bank.length];
      const views = Math.round(c.median * (k === 0 ? 3 + r() * 5 : 0.8 + r() * 2.2));
      return {
        id: `comp_${ci}_${k}`,
        creator: c.handle,
        hook,
        onScreenText: onScreen,
        transcript: `${hook} sample transcript — the weekly scrape replaces this with the first 15 seconds of real speech.`,
        caption: "sample caption — replaced by the weekly scrape",
        views,
        likes: Math.round(views * (0.04 + r() * 0.05)),
        comments: Math.round(views * (0.002 + r() * 0.004)),
        postedAt: new Date(TODAY.getTime() - Math.round(r() * 6 * 864e5)).toISOString(),
      };
    }),
  );
  return {
    meta: sampleMeta("sample generator — the sunday 06:00 job runs `npm run scrape:competitors`"),
    creators: creators.map(({ median: _m, ...c }) => c),
    reels,
  };
}

/* ---------------- calendar + scheduler ---------------- */

const SAMPLE_SCRIPT = (hook: string, angle: string, cta: string) => `## hook (0–3s)
${hook}

## setup (3–10s)
sample script — /script writes the real one to content/scripts/.

## body (10–45s)
1. ${angle}
2. one concrete example, shown on screen.
3. the takeaway in one sentence.

## cta (last 3s)
${cta}

## on-screen text
${hook.split(".")[0]}`;

function calendar(): CalendarEntry[] {
  const plan: [number, string, string, string, string, string, CalendarEntry["format"], CalendarEntry["status"]][] = [
    [-9, "18:00", "the context window, explained", "your ai forgets things. here's why.", "analogy: a desk that only fits 10 pages", "follow for part 2", "reel", "posted"],
    [-6, "12:30", "my full ai stack 2026", "every ai tool i pay for, and the ones i cancelled.", "receipts on screen; cost per month", "save this before you subscribe to anything", "carousel", "posted"],
    [-3, "18:00", "make a reel with ai in 5 min", "this whole reel was edited by ai. can you tell?", "reveal the edit timeline at the end", "comment 'edit' and i'll send the workflow", "reel", "posted"],
    [-1, "19:00", "hidden chatgpt settings", "turn this setting on before you use chatgpt again.", "screen recording, 3 settings, fast cuts", "save this for later", "carousel", "posted"],
    [1, "18:00", "what an ai agent actually is, part 2", "chatbots talk. agents do. here's the difference.", "one everyday task, done both ways", "follow for the clear version of ai", "reel", "scheduled"],
    [3, "12:00", "ai news in 30 seconds — week 46", "everything that happened in ai this week, in 30 seconds.", "top 3 from what's trending", "follow so you never miss a week", "reel", "scheduled"],
    [5, "18:30", "the prompt that writes prompts", "the only prompt you need to memorise.", "before/after answers side by side", "save this, you'll need it", "carousel", "scripted"],
    [8, "18:00", "is ai coming for your job", "the honest answer to 'will ai take my job'.", "contrarian: tasks, not jobs", "send this to a worried friend", "reel", "filmed"],
    [10, "19:00", "claude vs chatgpt for spreadsheets", "i gave both the same messy spreadsheet.", "split-screen race", "comment which one you use", "reel", "scripted"],
    [12, "12:30", "ai and your skincare labels", "i let ai read my skincare labels. bye bye, guesswork.", "brand tie-in: ingredient decoder", "save this for your next shop", "carousel", "idea"],
    [15, "18:00", "3 ai tools that feel illegal", "3 ai tools that feel illegal to know about.", "hook vault template", "follow for more", "reel", "idea"],
    [17, "18:00", "how i script a reel in 10 min", "my whole scripting process, in one minute.", "behind the scenes of /script", "comment 'script' for the template", "reel", "idea"],
  ];
  return plan.map(([offset, time, title, hook, angle, cta, format, status], i) => ({
    id: `cal_${String(i + 1).padStart(3, "0")}`,
    date: ymd(day(offset)),
    time,
    title,
    format,
    platforms: format === "carousel" ? ["instagram"] : ["instagram", "tiktok"],
    hook,
    angle,
    cta,
    status,
    source: i % 4 === 3 ? "manual" : "script",
    script: SAMPLE_SCRIPT(hook, angle, cta),
  }));
}

function scheduled(entries: CalendarEntry[]): ScheduledPost[] {
  const at = (e: CalendarEntry) => new Date(`${e.date}T${e.time}:00Z`).toISOString();
  const byStatus = (s: CalendarEntry["status"]) => entries.filter((e) => e.status === s);
  const cap = (e: CalendarEntry) => ({
    instagram: `${e.hook}\n\n${e.angle}.\n\n${e.cta} 🧠\n\n#ai #aitools #learnai #theclearcode`,
    tiktok: `${e.hook} · ${e.cta} #ai #learnontiktok`,
  });
  const posts: ScheduledPost[] = [];
  for (const e of byStatus("posted")) {
    posts.push({
      id: `post_${e.id.slice(4)}`, calendarEntryId: e.id, title: e.title, format: e.format, platforms: e.platforms,
      scheduledFor: at(e), captions: Object.fromEntries(e.platforms.map((p) => [p, cap(e)[p]])),
      media: e.format === "carousel" ? ["https://example.com/slide-1.jpg", "https://example.com/slide-2.jpg"] : ["https://example.com/sample.mp4"],
      status: "published", captionSource: "template", createdAt: day(-12).toISOString(), approvedAt: day(-11).toISOString(), approvalKey: "sample",
      results: Object.fromEntries(e.platforms.map((p) => [p, { ok: true, at: at(e), id: "sample" }])),
    });
  }
  // first upcoming one is approved, the next waits for approval
  for (const [i, e] of byStatus("scheduled").entries()) {
    posts.push({
      id: `post_${e.id.slice(4)}`, calendarEntryId: e.id, title: e.title, format: e.format, platforms: e.platforms,
      scheduledFor: at(e), captions: Object.fromEntries(e.platforms.map((p) => [p, cap(e)[p]])),
      media: i === 0 ? ["https://example.com/sample.mp4"] : [],
      status: i === 0 ? "approved" : "pending_approval", captionSource: "template", createdAt: day(-1).toISOString(),
      ...(i === 0 ? { approvedAt: day(-1).toISOString(), approvalKey: "sample" } : {}),
    });
  }
  // real fingerprints, so the sample approvals behave like real ones
  for (const p of posts) if (p.approvalKey) p.approvalKey = approvalKey(p);
  return posts;
}

/* ---------------- trending ---------------- */

function trending(): TrendingFile {
  const { between } = stream(33);
  const stories: [string, string][] = [
    ["Major lab launches a free tier for its newest model", "The company says the new tier includes limited daily use of its flagship model at no cost."],
    ["Open-source model beats closed rivals on 3 coding benchmarks", "Researchers released weights under a permissive licence; results are self-reported."],
    ["Phone maker adds on-device AI that reads your screen", "The assistant can now act across apps, with processing kept on the device."],
    ["Study: 40% of office tasks could be automated by agents", "The report separates tasks from whole jobs and finds most roles change rather than disappear."],
    ["New AI video tool turns one photo into a 10-second clip", "Creators get a beta with watermarking on by default."],
    ["Regulators open review into AI training on user posts", "The review covers consent and opt-out flows on major social apps."],
    ["Chip maker unveils accelerator 2x faster for inference", "Shipments are expected next year; cloud providers have pre-ordered."],
    ["Browser ships built-in AI that summarises any page", "The feature is off by default and runs a small local model."],
    ["AI note-takers compared: which one is worth paying for", "A hands-on review across accuracy, privacy and price."],
    ["Researchers show AI agents can be tricked by hidden text", "Prompt injection remains a top risk for agents that browse the web."],
    ["Music platform lets artists license their voice to AI", "Artists set prices and approve each use."],
    ["Small language model runs on a laptop with no internet", "The model targets offline note-taking and translation."],
    ["Social app tests AI-written captions for creators", "The test suggests captions and hashtags from the video's audio."],
    ["University releases free AI literacy course", "Eight short lessons, no coding required."],
    ["Startup raises $200M to build AI for spreadsheets", "The product turns plain-English questions into formulas and charts."],
    ["Lawsuit over AI-generated images moves to trial", "The case could set rules for training on copyrighted art."],
    ["Search engine launches AI mode in 40 new countries", "The mode answers with cited sources and follow-up questions."],
    ["How context windows work, explained with diagrams", "A long-form guide to why models forget earlier parts of a chat."],
    ["Report: AI tools cut time spent on email by a third", "The survey covered 2,000 knowledge workers."],
    ["Robotics lab demos home robot folding laundry", "The demo was teleoperated in parts, the lab said."],
    ["Translation app adds real-time voice dubbing", "The feature keeps the speaker's voice across 20 languages."],
    ["Ethics board publishes guidance on AI in hiring", "The guidance recommends human review of every rejection."],
    ["Vendor updates enterprise data connector pricing", "Changes apply to annual contracts from next quarter."],
    ["Image model learns to fix hands and text in pictures", "Text rendering errors dropped sharply in the lab's tests."],
  ];
  const items: TrendItem[] = stories.map(([title, summary], i) => {
    const source = TREND_SOURCES[i % TREND_SOURCES.length];
    const publishedAt = new Date(TODAY.getTime() - between(1, 60) * 36e5).toISOString();
    const score = scoreHookPotential(title, summary, publishedAt, TODAY);
    const { tag, reason } = ruleTag(title, summary, score);
    return {
      id: `trend_${String(i + 1).padStart(3, "0")}`,
      sourceId: source.id,
      title,
      summary,
      url: source.home,
      publishedAt,
      tag,
      reason,
      score,
      hookIdea: hookIdeaFor(title),
      taggedBy: "rules",
    };
  });
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return {
    meta: sampleMeta("sample generator — the daily 06:40 job runs `npm run trending:fetch`"),
    sources: TREND_SOURCES.map(({ id, name, url }) => ({ id, name, url })),
    items,
  };
}

/* ---------------- write ---------------- */

const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const cal = calendar();
const files: Record<string, () => unknown> = {
  hooks: () => ({ meta: sampleMeta("sample generator — save hooks here or from the competitor tracker"), hooks: hooks() }),
  analytics,
  competitors,
  scheduled: () => ({ meta: sampleMeta("sample generator"), posts: scheduled(cal) }),
  calendar: () => ({ meta: sampleMeta("sample generator — /script adds entries here"), entries: cal }),
  trending,
  "script-queue": () => ({ queue: [] }),
};

mkdirSync(DATA_DIR, { recursive: true });
for (const [name, build] of Object.entries(files)) {
  if (only && !only.includes(name)) continue;
  writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(build(), null, 2) + "\n");
  console.log(`wrote data/${name}.json`);
}
