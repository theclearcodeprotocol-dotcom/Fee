/**
 * Claude-powered helpers, each with a deterministic fallback so the dashboard
 * works with no API key (and in tests).
 *
 * Decision: Claude Opus 5.5 at low effort. These are short, high-volume
 * writing tasks where low effort holds quality; raise `effort` if captions
 * feel thin. Server-side refusal fallbacks are on (`fallbacks: "default"`), so
 * a declined request is retried on another model inside the same call.
 * Structured outputs (zod) guarantee the JSON shape we render.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { PLATFORMS, type HookFormat, type Platform } from "./types";
import { hookFormatSchema, platformSchema } from "./schemas";

const MODEL = "claude-opus-5-5";

const BRAND_VOICE = `You write for "the clear code." (@theclearcode), a creator who explains AI clearly for non-technical people.
Voice: between professional and playful; warm, bold, a little cheeky. Write in lower-case, like the brand.
No corporate filler, no "unlock", "game-changer", "dive in" or "in today's fast-paced world". Short sentences.`;

let client: Anthropic | null = null;
function getClient() {
  // Credentials resolve from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile.
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  return client;
}

export type AiSource = "claude" | "template";

/* ---------------- captions ---------------- */

const captionsSchema = z.object({
  captions: z.array(z.object({ platform: platformSchema, caption: z.string() })),
});

const PLATFORM_RULES: Record<Platform, string> = {
  instagram: "Instagram Reels: 1–3 short lines, a save/share prompt, 3–5 hashtags at the end including #theclearcode.",
  tiktok: "TikTok: one punchy line under 150 characters plus 2–4 hashtags.",
  youtube: "YouTube Shorts title: under 90 characters, no hashtags, curiosity-led.",
  linkedin: "LinkedIn: 3–5 short lines, a practical takeaway, no hashtags or at most 2.",
  x: "X: under 260 characters, one line, at most 1 hashtag.",
};

export async function generateCaptions(input: { title: string; brief: string; platforms: Platform[] }): Promise<{
  captions: Partial<Record<Platform, string>>;
  source: AiSource;
  error?: string;
}> {
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(captionsSchema) },
      system: BRAND_VOICE,
      messages: [
        {
          role: "user",
          content: `Write one caption per platform for this short-form video.

<video>
title: ${input.title}
brief: ${input.brief || "(none)"}
</video>

Platform rules:
${input.platforms.map((p) => `- ${p}: ${PLATFORM_RULES[p]}`).join("\n")}

Return a caption for exactly these platforms: ${input.platforms.join(", ")}.`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error(response.stop_reason === "refusal" ? "Claude declined this request" : "no structured output");
    }
    const captions: Partial<Record<Platform, string>> = {};
    for (const { platform, caption } of response.parsed_output.captions) {
      if (input.platforms.includes(platform)) captions[platform] = caption.trim();
    }
    return { captions, source: "claude" };
  } catch (err) {
    return { captions: templateCaptions(input), source: "template", error: describe(err) };
  }
}

/** Deterministic captions used when Claude isn't available. */
export function templateCaptions({ title, brief, platforms }: { title: string; brief: string; platforms: Platform[] }) {
  const t = title.toLowerCase().trim();
  const line = brief.trim().split(/[.\n]/)[0]?.toLowerCase().trim();
  const out: Partial<Record<Platform, string>> = {};
  for (const p of platforms) {
    const limit = PLATFORMS.find((x) => x.id === p)!.captionLimit;
    const text = {
      instagram: `${t}.${line ? `\n\n${line}.` : ""}\n\nsave this for later and send it to the friend who needs it 🧠\n\n#ai #aitools #learnai #theclearcode`,
      tiktok: `${t} 👀 #ai #aitools #learnontiktok`,
      youtube: t.length > 90 ? `${t.slice(0, 87)}…` : t,
      linkedin: `${t}.${line ? `\n\n${line}.` : ""}\n\nthe short version: you don't need to be technical to use this well.`,
      x: `${t}${line ? ` — ${line}` : ""}`,
    }[p];
    out[p] = text.slice(0, limit);
  }
  return out;
}

/* ---------------- hook templating ---------------- */

const templateSchema = z.object({ template: z.string(), format: hookFormatSchema });

export async function templateHook(transcript: string): Promise<{ template: string; format: HookFormat; source: AiSource }> {
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(templateSchema) },
      messages: [
        {
          role: "user",
          content: `Turn this viral video hook into a reusable template.
Replace the specific parts (tools, numbers, audiences, results, time frames) with short [bracketed placeholders]; keep the structure and the words that make it work.
Also classify its format: curiosity, contrarian, listicle, story, pov, how-to, result-first or callout.

<hook>${transcript}</hook>`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("no output");
    return { ...response.parsed_output, source: "claude" };
  } catch {
    return { ...heuristicTemplate(transcript), source: "template" };
  }
}

const TOOLS = /\b(chatgpt|claude|gemini|copilot|midjourney|notion|canva|capcut|perplexity|grok|llama|ai)\b/gi;

export function heuristicTemplate(transcript: string): { template: string; format: HookFormat } {
  const template = transcript
    .replace(TOOLS, "[tool]")
    .replace(/\bin (under )?\d+\s?(seconds?|minutes?|mins?|hours?|days?)\b/gi, "in $1[short time]")
    .replace(/\b(20\d\d)\b/g, "[year]")
    .replace(/\b\d+(\.\d+)?(%|x|k|m)?\b/gi, "[number]");
  return { template, format: guessFormat(transcript) };
}

export function guessFormat(t: string): HookFormat {
  const s = t.toLowerCase();
  if (s.startsWith("pov")) return "pov";
  if (/^(stop|don't|you don't|unpopular|nobody needs)/.test(s)) return "contrarian";
  if (/^\d+|\b\d+ (ways|tools|things|prompts|words|apps)\b/.test(s)) return "listicle";
  if (/^(here's how|how to|how i)/.test(s)) return "how-to";
  if (/^if you('re| are)/.test(s)) return "callout";
  if (/^(i |last |when i)/.test(s)) return /\b(replaced|made|saved|shipped|built)\b/.test(s) ? "result-first" : "story";
  return "curiosity";
}

function describe(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return "no valid Anthropic credentials — using templates";
  if (err instanceof Anthropic.RateLimitError) return "rate limited — using templates";
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status} — using templates`;
  if (err instanceof Error && /authentication/i.test(err.message)) return "no ANTHROPIC_API_KEY set — using templates";
  if (err instanceof Error) return `${err.message} — using templates`;
  return "Claude unavailable — using templates";
}
