/**
 * Claude-powered helpers, each with a deterministic fallback so the dashboard
 * and the scheduled jobs work with no API key.
 *
 * Imported by the Next.js app AND by scripts under plain Node, so relative
 * imports carry explicit .ts extensions.
 *
 * Decision: Claude Opus 5.5 at low effort for these short writing / labelling
 * tasks (raise `effort` if output feels thin). Server-side refusal fallbacks
 * are on (`fallbacks: "default"`), and structured outputs (zod) guarantee the
 * JSON shape we store.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { HookFormat, Platform, PostFormat, TrendTag } from "./types.ts";
import { hookFormatSchema, platformSchema } from "./schemas.ts";

const MODEL = "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"];

const BRAND_VOICE = `You write for "the clear code." (Instagram @theclearcode_), the brand behind The Clear Code Protocol:
a done-for-you framework that helps skin specialists and acne specialists build and run their own acne programmes
inside their clinics (plan, launch, nurture). The audience is skin and acne specialists and clinic owners.
Voice: between professional and playful; feminine, warm, bold. Lower-case, like the brand.
No corporate filler ("unlock", "game-changer", "dive in", "in today's fast-paced world"). Short sentences.
Never make medical claims or promise skin results.`;

/** Fallback hashtags (and the tags Claude is asked to include). */
export const BRAND_HASHTAGS = "#acnespecialist #skinspecialist #acnetreatment #skinclinic #theclearcode";

let client: Anthropic | null = null;
function getClient() {
  // Credentials resolve from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile.
  client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 });
  return client;
}

export type AiSource = "claude" | "template";

/** One structured-output call. Throws on refusal or missing output so callers fall back. */
async function ask<T extends z.ZodType>(schema: T, content: Anthropic.Beta.BetaContentBlockParam[] | string, system?: string) {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    ...(system ? { system } : {}),
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined this request");
  if (!response.parsed_output) throw new Error("no structured output");
  return response.parsed_output as z.infer<T>;
}

export function describeAiError(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return "Anthropic key rejected — used templates";
  if (err instanceof Anthropic.RateLimitError) return "Claude rate-limited — used templates";
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status} — used templates`;
  if (err instanceof Error && /authentication/i.test(err.message)) return "no ANTHROPIC_API_KEY set — used templates";
  if (err instanceof Error) return `${err.message} — used templates`;
  return "Claude unavailable — used templates";
}

/* ---------------- captions (scheduler) ---------------- */

export interface CaptionInput {
  title: string;
  hook: string;
  angle: string;
  cta: string;
  format: PostFormat;
  platforms: Platform[];
}

const PLATFORM_RULES: Record<Platform, string> = {
  instagram:
    `Instagram: open with the hook as the first line (it shows before 'more'), 2–4 short lines that deliver the angle, end with the CTA, then 3–5 hashtags drawn from: ${BRAND_HASHTAGS}. For a carousel, tease the slides ('swipe →').`,
  tiktok: "TikTok: the hook in one punchy line, one line of angle, the CTA, then 2–4 hashtags. Under 300 characters.",
};

export async function generateCaptions(input: CaptionInput): Promise<{
  captions: Partial<Record<Platform, string>>;
  source: AiSource;
  error?: string;
}> {
  try {
    const out = await ask(
      z.object({ captions: z.array(z.object({ platform: platformSchema, caption: z.string() })) }),
      `Write one caption per platform for this ${input.format}.

<post>
title: ${input.title}
hook: ${input.hook}
angle: ${input.angle || "(none)"}
cta: ${input.cta || "(none — pick a save or follow prompt)"}
</post>

Rules:
${input.platforms.map((p) => `- ${PLATFORM_RULES[p]}`).join("\n")}

Return exactly these platforms: ${input.platforms.join(", ")}.`,
      BRAND_VOICE,
    );
    const captions: Partial<Record<Platform, string>> = {};
    for (const { platform, caption } of out.captions) if (input.platforms.includes(platform)) captions[platform] = caption.trim();
    if (input.platforms.some((p) => !captions[p])) throw new Error("missing a platform caption");
    return { captions, source: "claude" };
  } catch (err) {
    return { captions: templateCaptions(input), source: "template", error: describeAiError(err) };
  }
}

/** Deterministic captions: hook + angle + CTA + tags. */
export function templateCaptions({ hook, angle, cta, format, platforms }: CaptionInput) {
  const h = hook.trim().replace(/\s+/g, " ");
  const a = angle.trim();
  const c = cta.trim() || (format === "carousel" ? "save this for later 📌" : "follow for more from the clear code protocol 🧚‍♀️");
  const out: Partial<Record<Platform, string>> = {};
  for (const p of platforms) {
    out[p] =
      p === "instagram"
        ? [h, a, format === "carousel" ? "swipe →" : "", c, BRAND_HASHTAGS].filter(Boolean).join("\n\n")
        : [h, a ? a.split(/[.\n]/)[0] : "", c, BRAND_HASHTAGS.split(" ").slice(0, 3).join(" ")].filter(Boolean).join(" · ").slice(0, 2200);
  }
  return out;
}

/* ---------------- hook templating (hook vault) ---------------- */

export async function templateHook(
  transcript: string,
  niche?: string,
): Promise<{ template: string; format: HookFormat; niche: string; source: AiSource }> {
  try {
    const out = await ask(
      z.object({ template: z.string(), format: hookFormatSchema, niche: z.string() }),
      `Turn this viral video hook into a reusable template.

Keep the structure and the words that make it work; replace the specifics with short [bracketed] slots.
Use these canonical slot names where they fit: [x], [y], [number], [tool], [audience], [result], [time].
Examples:
- "ChatGPT just killed Google search" → "[x] just killed [y]"
- "Stop doing your own captions" → "stop doing [x]"
- "5 things I wish I knew before freelancing" → "[number] things i wish i knew before [x]"

Also give its format (curiosity, contrarian, listicle, story, pov, how-to, result-first, callout or news)
and a 1–3 word lower-case niche${niche ? ` (the creator's niche is "${niche}" — use it unless the hook is clearly about something else)` : ""}.

<hook>${transcript}</hook>`,
    );
    return { ...out, niche: out.niche.toLowerCase(), source: "claude" };
  } catch {
    return { ...heuristicTemplate(transcript), niche: niche ?? "general", source: "template" };
  }
}

/** Known hook archetypes first (the shapes worth naming), then generic slot replacement. */
const tail = (rest: string) => {
  const m = rest.trim().match(/^(before|about|when|as|at)\b/i);
  return m ? ` ${m[1].toLowerCase()} [x]` : "";
};
const ARCHETYPES: [RegExp, (m: RegExpMatchArray) => string, HookFormat][] = [
  [/^(.+?)\s+just\s+(killed|replaced|ended|broke|changed)\s+(.+?)([.!?]|$)/i, (m) => `[x] just ${m[2].toLowerCase()} [y]`, "news"],
  [/^stop\s+(doing|using|saying|making|posting|buying)\s+(.+?)([.!?]|$)/i, (m) => `stop ${m[1].toLowerCase()} [x]`, "contrarian"],
  [/^(\d+|three|five|seven|ten)\s+things\s+i\s+wish\s+i\s+(knew|had known)\b(.*?)([.!?]|$)/i, (m) => `[number] things i wish i knew${tail(m[3])}`, "listicle"],
  [/^(\d+|three|five|ten)\s+(.+?)\s+that\s+feel\s+illegal\s+to\s+know/i, () => "[number] [x] that feel illegal to know", "listicle"],
  [/^nobody\s+(is\s+talking|talks)\s+about\s+(.+?)([.!?]|$)/i, () => "nobody is talking about [x]", "curiosity"],
  [/^if\s+you('re| are)\s+(.+?),\s*(.+)$/i, (m) => `if you're [audience], ${m[3].replace(/\.$/, "")}`, "callout"],
  [/^pov:\s*(.+)$/i, () => "pov: [x]", "pov"],
];

export function heuristicTemplate(transcript: string): { template: string; format: HookFormat } {
  const t = transcript.trim();
  for (const [re, build, format] of ARCHETYPES) {
    const m = t.match(re);
    if (m) return { template: genericSlots(build(m)), format };
  }
  return { template: genericSlots(t), format: guessFormat(t) };
}

const TOOLS = /\b(chatgpt|claude|gemini|copilot|midjourney|notion|canva|capcut|perplexity|grok|llama)\b/gi;
function genericSlots(s: string) {
  return s
    .replace(TOOLS, "[tool]")
    .replace(/\bin (under )?\d+\s?(seconds?|minutes?|mins?|hours?|days?)\b/gi, "in $1[time]")
    .replace(/\b(20\d\d)\b/g, "[year]")
    .replace(/(?<!\[)\b\d+(\.\d+)?(%|x|k|m)?\b(?![^[]*\])/gi, "[number]");
}

export function guessFormat(t: string): HookFormat {
  const s = t.toLowerCase();
  if (s.startsWith("pov")) return "pov";
  if (/^(stop|don't|you don't|unpopular|nobody needs)/.test(s)) return "contrarian";
  if (/^(i |last |when i)/.test(s)) return /\b(replaced|made|saved|shipped|built)\b/.test(s) ? "result-first" : "story";
  if (/^\d+|\b\d+ (ways|tools|things|prompts|words|apps)\b/.test(s)) return "listicle";
  if (/^(here's how|how to|how i)/.test(s)) return "how-to";
  if (/^if you('re| are)/.test(s)) return "callout";
  if (/\bjust (killed|launched|dropped|replaced)\b/.test(s)) return "news";
  return "curiosity";
}

/* ---------------- on-screen text (competitor scrape) ---------------- */

/** Read the text burned into the opening frames of a reel. Returns "" when there is none. */
export async function readOnScreenText(framesJpeg: Buffer[]): Promise<string> {
  const out = await ask(z.object({ text: z.string() }), [
    ...framesJpeg.map((data) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/jpeg" as const, data: data.toString("base64") },
    })),
    {
      type: "text" as const,
      text: `These are frames from the first 3 seconds of a short-form video, in order.
Transcribe the on-screen text overlay (the title or hook text added in editing) exactly as written, once, even if it repeats across frames.
Ignore captions/subtitles that simply mirror speech, app UI, watermarks and usernames. If there is no overlay text, return an empty string.`,
    },
  ]);
  return out.text.trim();
}

/* ---------------- trend tagging ---------------- */

export async function tagTrends(
  items: { id: string; title: string; summary: string }[],
): Promise<Map<string, { tag: TrendTag; reason: string; hookIdea: string }>> {
  const out = await ask(
    z.object({
      items: z.array(
        z.object({ id: z.string(), tag: z.enum(["hook potential", "explainer", "skip"]), reason: z.string(), hookIdea: z.string() }),
      ),
    }),
    `Tag each AI news item for a short-form creator who explains AI to non-technical people.

- "hook potential": a viewer would stop scrolling in the first 2 seconds — personal stakes, a famous name, a surprising number, a fight, or news they'll hear about elsewhere today.
- "explainer": worth covering, but it needs a slower "here's what this means" video, not a punchy hook.
- "skip": niche, incremental, B2B, or not interesting to a general audience.

For each item give a one-line reason (under 15 words) and a hookIdea: the first line the creator would say to camera, lower-case, under 20 words.

<items>
${items.map((i) => `<item id="${i.id}"><title>${i.title}</title><summary>${i.summary}</summary></item>`).join("\n")}
</items>`,
    BRAND_VOICE,
  );
  return new Map(out.items.map((i) => [i.id, { tag: i.tag, reason: i.reason, hookIdea: i.hookIdea }]));
}

/* ---------------- why a reel popped (analytics) ---------------- */

export async function explainHeaters(
  reels: { id: string; hook: string; title: string; stats: string }[],
): Promise<Map<string, string>> {
  const out = await ask(
    z.object({ notes: z.array(z.object({ id: z.string(), note: z.string() })) }),
    `Each reel below beat the creator's 30-day median views by at least 2×. For each one, write ONE line (under 18 words, lower-case)
on what most likely made it pop. Ground it in the numbers given (which rate stands out vs their average) and the hook's structure.
Don't invent facts beyond what's given.

${reels.map((r) => `<reel id="${r.id}"><title>${r.title}</title><hook>${r.hook}</hook><stats>${r.stats}</stats></reel>`).join("\n")}`,
  );
  return new Map(out.notes.map((n) => [n.id, n.note]));
}
