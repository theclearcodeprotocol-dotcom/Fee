/**
 * Writes deterministic SAMPLE data to /data so every page renders before any
 * real source is connected. Every file it writes has meta.sample = true, and
 * the UI shows a "sample data" notice while that is the case.
 *
 *   npm run seed            # (re)write all data files
 *   npm run seed -- --only=analytics,trending
 *
 * Runs under plain Node (>= 22.18, built-in TypeScript type stripping).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { scoreHookPotential, potentialFromScore, hookIdeaFor } from "../lib/hook-potential.ts";
import { TREND_SOURCES } from "../lib/trend-sources.ts";
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
// Anchor date for the sample world. Real data replaces this; nothing reads the clock.
const TODAY = new Date("2026-11-11T09:00:00Z");
const day = (offset: number) => new Date(TODAY.getTime() + offset * 864e5);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Small seeded PRNG (mulberry32) so the sample is identical on every run.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261111);
const between = (a: number, b: number) => Math.round(a + rand() * (b - a));

const sampleMeta = (source: string) => ({ sample: true, source, updatedAt: TODAY.toISOString() });

/* ---------------- hooks ---------------- */

const hooks: Hook[] = [
  { transcript: "Stop using ChatGPT like Google. Here's what it's actually for.", template: "Stop using [tool] like [familiar thing]. Here's what it's actually for.", format: "contrarian", creator: "@aidaily.demo", platform: "instagram", views: 1_240_000, tags: ["ai tools", "mindset"] },
  { transcript: "I replaced 4 apps with one prompt, and I'm never going back.", template: "I replaced [number] [things] with one [simple fix], and I'm never going back.", format: "result-first", creator: "@nocodenina.demo", platform: "tiktok", views: 880_000, tags: ["productivity"] },
  { transcript: "3 AI tools that feel illegal to know about.", template: "[number] [category] that feel illegal to know about.", format: "listicle", creator: "@techtok.demo", platform: "instagram", views: 2_100_000, tags: ["ai tools", "list"] },
  { transcript: "POV: you finally understand what an AI agent is.", template: "POV: you finally understand [confusing concept].", format: "pov", creator: "@theclearcode", platform: "instagram", views: 410_000, tags: ["explainer"] },
  { transcript: "Nobody is talking about the most useful feature in Claude.", template: "Nobody is talking about the most useful feature in [product].", format: "curiosity", creator: "@founderfiles.demo", platform: "tiktok", views: 960_000, tags: ["ai tools", "hidden feature"] },
  { transcript: "If you're a woman in tech, save this before your next salary review.", template: "If you're [specific audience], save this before your next [high-stakes moment].", format: "callout", creator: "@careercode.demo", platform: "instagram", views: 650_000, tags: ["career", "save bait"] },
  { transcript: "Last year I couldn't write a line of code. Last week I shipped an app.", template: "Last [time] I couldn't [skill]. Last [short time] I [impressive result].", format: "story", creator: "@nocodenina.demo", platform: "youtube", views: 1_530_000, tags: ["transformation"] },
  { transcript: "Here's how to make AI write in your voice in under 60 seconds.", template: "Here's how to [desired outcome] in under [short time].", format: "how-to", creator: "@aidaily.demo", platform: "instagram", views: 720_000, tags: ["prompting", "tutorial"] },
  { transcript: "This is why your prompts give you boring answers.", template: "This is why your [thing] gives you [bad result].", format: "curiosity", creator: "@promptlab.demo", platform: "tiktok", views: 1_050_000, tags: ["prompting"] },
  { transcript: "You don't need to learn to code in 2026. You need to learn this.", template: "You don't need to [common advice] in [year]. You need to learn this.", format: "contrarian", creator: "@techtok.demo", platform: "instagram", views: 3_400_000, tags: ["career", "hot take"] },
  { transcript: "I asked AI to plan my week and it did something I didn't expect.", template: "I asked [tool] to [everyday task] and it did something I didn't expect.", format: "story", creator: "@founderfiles.demo", platform: "instagram", views: 540_000, tags: ["experiment"] },
  { transcript: "5 words that make every AI answer better.", template: "[number] words that make every [output] better.", format: "listicle", creator: "@promptlab.demo", platform: "tiktok", views: 2_700_000, tags: ["prompting", "list"] },
].map((h, i) => ({
  id: `hook_${String(i + 1).padStart(3, "0")}`,
  savedAt: day(-i * 2 - 1).toISOString(),
  ...h,
})) as Hook[];

/* ---------------- analytics ---------------- */

function analytics(): AnalyticsFile {
  const daily = Array.from({ length: 28 }, (_, i) => {
    const d = day(i - 27);
    const trend = 1 + i * 0.025; // slow growth over the month
    const spike = [6, 13, 19, 24, 26].includes(i) ? 2.4 : 1; // days a reel popped
    const views = Math.round(between(9_000, 14_000) * trend * spike);
    return {
      date: ymd(d),
      views,
      saves: Math.round(views * (0.018 + rand() * 0.012)),
      follows: Math.round(views * (0.0022 + rand() * 0.0016)),
    };
  });
  const titles: [string, string][] = [
    ["what an ai agent actually is", "you've heard 'agent' 100 times this week. here's what it means."],
    ["3 prompts i use every day", "3 prompts i use every single day, steal them."],
    ["claude vs chatgpt for writing", "i gave claude and chatgpt the same brief. one was way better."],
    ["the 60-second voice prompt", "make ai write like you in 60 seconds."],
    ["why your prompts are boring", "this is why your ai answers sound like a robot."],
    ["ai news in 30 seconds", "everything that happened in ai this week, in 30 seconds."],
    ["automate your inbox", "i haven't sorted an email by hand in 3 months."],
    ["the context window, explained", "your ai forgets things. here's why."],
    ["build a website with no code", "i built this site in 11 minutes with zero code."],
    ["ai for your skincare routine", "i asked ai to fix my skincare routine. bye bye, guesswork."],
    ["stop saying 'please' to chatgpt?", "does being polite to ai actually change the answer?"],
    ["my full ai stack 2026", "every ai tool i pay for, and the ones i cancelled."],
    ["make a reel with ai in 5 min", "this whole reel was edited by ai. can you tell?"],
    ["the prompt that writes prompts", "the only prompt you need to memorise."],
    ["is ai coming for your job", "the honest answer to 'will ai take my job'."],
    ["hidden chatgpt settings", "turn this setting on before you use chatgpt again."],
  ];
  const reels = titles.map(([title, hook], i) => {
    const posted = day(-27 + Math.round((i * 27) / (titles.length - 1)));
    const heat = [2, 9, 12, 13, 15].includes(i) ? between(3, 6) : 1;
    const views = between(12_000, 38_000) * heat;
    return {
      id: `reel_${String(i + 1).padStart(3, "0")}`,
      title,
      hook,
      postedAt: posted.toISOString(),
      views,
      saves: Math.round(views * (0.015 + rand() * 0.03)),
      shares: Math.round(views * (0.004 + rand() * 0.01)),
      follows: Math.round(views * (0.002 + rand() * 0.004)),
    };
  });
  return { meta: sampleMeta("sample generator — connect Instagram Graph API or Metricool"), handle: "@theclearcode", daily, reels };
}

/* ---------------- competitors ---------------- */

function competitors(): CompetitorsFile {
  const creators = [
    { handle: "@techtok.demo", name: "techtok", niche: "ai tools", followers: 412_000, medianViews: 85_000 },
    { handle: "@aidaily.demo", name: "ai daily", niche: "ai news", followers: 268_000, medianViews: 54_000 },
    { handle: "@nocodenina.demo", name: "no-code nina", niche: "no-code", followers: 131_000, medianViews: 31_000 },
    { handle: "@promptlab.demo", name: "prompt lab", niche: "prompting", followers: 590_000, medianViews: 120_000 },
    { handle: "@founderfiles.demo", name: "founder files", niche: "ai for business", followers: 98_000, medianViews: 22_000 },
    { handle: "@careercode.demo", name: "career code", niche: "tech careers", followers: 204_000, medianViews: 40_000 },
  ];
  const hookBank = [
    "the ai feature apple didn't announce on stage",
    "i let an ai agent run my business for a week",
    "stop paying for these 4 ai tools",
    "this prompt saved me 10 hours this week",
    "google just made this free for everyone",
    "the one setting that makes chatgpt 2x smarter",
    "ai can now watch your screen. here's how to use it",
    "i tried every ai note-taker so you don't have to",
    "what nobody tells you about learning ai in 2026",
    "this is the cheapest way to build an app right now",
    "3 ai jobs that didn't exist last year",
    "you're using claude wrong (do this instead)",
  ];
  const reels = creators.flatMap((c, ci) =>
    Array.from({ length: 3 }, (_, k) => {
      const multiple = k === 0 ? 2 + rand() * 6 : 0.6 + rand() * 1.6;
      const views = Math.round(c.medianViews * multiple);
      return {
        id: `comp_${ci}_${k}`,
        creator: c.handle,
        hook: hookBank[(ci * 2 + k) % hookBank.length],
        caption: "sample caption — replaced by the weekly scrape",
        views,
        likes: Math.round(views * (0.04 + rand() * 0.05)),
        comments: Math.round(views * (0.002 + rand() * 0.004)),
        postedAt: day(-between(0, 6)).toISOString(),
      };
    }),
  );
  return { meta: sampleMeta("sample generator — run `npm run scrape:competitors` with APIFY_TOKEN"), creators, reels };
}

/* ---------------- scheduler ---------------- */

const scheduled: ScheduledPost[] = [
  {
    id: "post_001",
    title: "what an ai agent actually is (part 2)",
    brief: "follow-up to the agent explainer: agents vs. chatbots, one everyday example.",
    scheduledFor: day(1).toISOString().replace("09:00", "17:30"),
    platforms: ["instagram", "tiktok", "youtube"],
    captions: {
      instagram: "agents, part 2. the difference between a chatbot and an agent is one word: action. save this for later 🧠\n\n#ai #aiagents #theclearcode",
      tiktok: "chatbot vs agent — the one-word difference #ai #aiagents",
      youtube: "chatbot vs ai agent: the one-word difference",
    },
    status: "scheduled",
    createdAt: day(-1).toISOString(),
  },
  {
    id: "post_002",
    title: "ai news in 30 seconds — week 46",
    brief: "weekly roundup from the trending page, top 3 high-potential stories.",
    scheduledFor: day(3).toISOString().replace("09:00", "12:00"),
    platforms: ["instagram", "tiktok", "linkedin", "x"],
    captions: {
      instagram: "everything that happened in ai this week, in 30 seconds. which one surprised you? 👇",
      tiktok: "ai news in 30 seconds ⏱️ #ainews",
      linkedin: "three ai stories from this week worth 30 seconds of your time, and what they mean for how we work.",
      x: "ai news in 30 seconds — week 46 🧵",
    },
    status: "scheduled",
    createdAt: day(-2).toISOString(),
  },
];

/* ---------------- calendar ---------------- */

function calendar(): CalendarEntry[] {
  const plan: [number, string, string, string, CalendarEntry["status"]][] = [
    [-9, "the context window, explained", "your ai forgets things. here's why.", "analogy: a desk that only fits 10 pages", "posted"],
    [-6, "my full ai stack 2026", "every ai tool i pay for, and the ones i cancelled.", "receipts on screen; cost per month", "posted"],
    [-3, "make a reel with ai in 5 min", "this whole reel was edited by ai. can you tell?", "reveal the edit timeline at the end", "posted"],
    [-1, "hidden chatgpt settings", "turn this setting on before you use chatgpt again.", "screen recording, 3 settings, fast cuts", "edited"],
    [1, "what an ai agent actually is, part 2", "chatbots talk. agents do. here's the difference.", "one everyday task, done both ways", "filmed"],
    [3, "ai news in 30 seconds — week 46", "everything that happened in ai this week, in 30 seconds.", "pull top 3 from what's trending", "scripted"],
    [5, "the prompt that writes prompts", "the only prompt you need to memorise.", "show before/after answer side by side", "scripted"],
    [8, "is ai coming for your job", "the honest answer to 'will ai take my job'.", "contrarian: tasks, not jobs", "idea"],
    [10, "claude vs chatgpt for spreadsheets", "i gave both the same messy spreadsheet.", "split screen race", "idea"],
    [12, "ai for your skincare routine, part 2", "i let ai read my skincare labels. bye bye, guesswork.", "brand tie-in: ingredient decoder", "idea"],
    [15, "3 ai tools that feel illegal", "3 ai tools that feel illegal to know about.", "hook vault template #3", "idea"],
    [17, "how i script a reel in 10 min", "my whole scripting process, in one minute.", "behind the scenes of /script", "idea"],
  ];
  return plan.map(([offset, title, hook, angle, status], i) => ({
    id: `cal_${String(i + 1).padStart(3, "0")}`,
    date: ymd(day(offset)),
    title,
    hook,
    angle,
    platforms: i % 3 === 0 ? ["instagram", "tiktok", "youtube"] : ["instagram", "tiktok"],
    status,
    source: i % 4 === 3 ? "manual" : "script",
    scriptPath: i % 4 === 3 ? undefined : `content/scripts/${ymd(day(offset))}-${title.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")}.md`,
  }));
}

/* ---------------- trending ---------------- */

function trending(): TrendingFile {
  const stories: [string, string, string[]][] = [
    ["Major lab launches a free tier for its newest model", "The company says the new tier includes limited daily use of its flagship model at no cost.", ["models", "pricing"]],
    ["Open-source model beats closed rivals on 3 coding benchmarks", "Researchers released weights under a permissive licence; results are self-reported.", ["open source", "coding"]],
    ["Phone maker adds on-device AI that reads your screen", "The assistant can now act across apps, with processing kept on the device.", ["devices", "agents"]],
    ["Study: 40% of office tasks could be automated by agents", "The report separates tasks from whole jobs and finds most roles change rather than disappear.", ["jobs", "research"]],
    ["New AI video tool turns one photo into a 10-second clip", "Creators get a beta with watermarking on by default.", ["video", "creators"]],
    ["Regulators open review into AI training on user posts", "The review covers consent and opt-out flows on major social apps.", ["policy", "privacy"]],
    ["Chip maker unveils accelerator 2x faster for inference", "Shipments are expected next year; cloud providers have pre-ordered.", ["hardware"]],
    ["Browser ships built-in AI that summarises any page", "The feature is off by default and runs a small local model.", ["browsers", "tools"]],
    ["AI note-takers compared: which one is worth paying for", "A hands-on review across accuracy, privacy and price.", ["tools", "review"]],
    ["Researchers show AI agents can be tricked by hidden text", "Prompt injection remains a top risk for agents that browse the web.", ["safety", "agents"]],
    ["Music platform lets artists license their voice to AI", "Artists set prices and approve each use.", ["music", "creators"]],
    ["Small language model runs on a laptop with no internet", "The model targets offline note-taking and translation.", ["models", "local"]],
    ["Social app tests AI-written captions for creators", "The test suggests captions and hashtags from the video's audio.", ["social", "creators"]],
    ["University releases free AI literacy course", "Eight short lessons, no coding required.", ["education"]],
    ["Startup raises $200M to build AI for spreadsheets", "The product turns plain-English questions into formulas and charts.", ["funding", "tools"]],
    ["Lawsuit over AI-generated images moves to trial", "The case could set rules for training on copyrighted art.", ["policy", "legal"]],
    ["Search engine launches AI mode in 40 new countries", "The mode answers with cited sources and follow-up questions.", ["search"]],
    ["AI model can now take actions in a desktop app", "Early testers report it is slow but reliable for repetitive tasks.", ["agents"]],
    ["Report: AI tools cut time spent on email by a third", "The survey covered 2,000 knowledge workers.", ["productivity", "research"]],
    ["Robotics lab demos home robot folding laundry", "The demo was teleoperated in parts, the lab said.", ["robotics"]],
    ["Translation app adds real-time voice dubbing", "The feature keeps the speaker's voice across 20 languages.", ["voice", "tools"]],
    ["Ethics board publishes guidance on AI in hiring", "The guidance recommends human review of every rejection.", ["jobs", "policy"]],
    ["Developer tool makes AI pair programming the default", "The update writes tests alongside every change.", ["coding", "tools"]],
    ["Image model learns to fix hands and text in pictures", "Text rendering errors dropped sharply in the lab's tests.", ["images"]],
  ];
  const items: TrendItem[] = stories.map(([title, summary, tags], i) => {
    const source = TREND_SOURCES[i % TREND_SOURCES.length];
    const publishedAt = new Date(TODAY.getTime() - between(1, 140) * 36e5).toISOString();
    const score = scoreHookPotential(title, summary, publishedAt, TODAY);
    return {
      id: `trend_${String(i + 1).padStart(3, "0")}`,
      sourceId: source.id,
      title,
      summary,
      url: source.home,
      publishedAt,
      score,
      potential: potentialFromScore(score),
      hookIdea: hookIdeaFor(title),
      tags,
    };
  });
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return {
    meta: sampleMeta("sample generator — run `npm run trending:fetch` for live feeds"),
    sources: TREND_SOURCES.map(({ id, name, url }) => ({ id, name, url })),
    items,
  };
}

/* ---------------- write ---------------- */

const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const files: Record<string, () => unknown> = {
  hooks: () => ({ meta: sampleMeta("sample generator — add hooks from the vault or POST /api/hooks"), hooks }),
  analytics,
  competitors,
  scheduled: () => ({ meta: sampleMeta("dashboard scheduler"), posts: scheduled }),
  calendar: () => ({ meta: sampleMeta("sample generator — /script appends here"), entries: calendar() }),
  trending,
};

mkdirSync(DATA_DIR, { recursive: true });
for (const [name, build] of Object.entries(files)) {
  if (only && !only.includes(name)) continue;
  writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(build(), null, 2) + "\n");
  console.log(`wrote data/${name}.json`);
}
