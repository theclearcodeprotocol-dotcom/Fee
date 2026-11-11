/** zod schemas for everything that enters through a form, an API route or a script. */
import { z } from "zod";

export const platformSchema = z.enum(["instagram", "tiktok"]);
export const formatSchema = z.enum(["reel", "carousel"]);
export const hookFormatSchema = z.enum(["curiosity", "contrarian", "listicle", "story", "pov", "how-to", "result-first", "callout", "news"]);

const optionalUrl = z.url().optional().or(z.literal("").transform(() => undefined));

export const newHookSchema = z.object({
  transcript: z.string().trim().min(3).max(600),
  template: z.string().trim().max(600).optional(),
  format: hookFormatSchema.optional(),
  niche: z.string().trim().max(40).optional(),
  creator: z.string().trim().min(1).max(80),
  platform: platformSchema.default("instagram"),
  url: optionalUrl,
  views: z.coerce.number().int().nonnegative().optional(),
  onScreenText: z.string().max(400).optional(),
  sourceReelId: z.string().optional(),
});

export const calendarEntryInputSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).default("18:00"),
  title: z.string().trim().min(1).max(160),
  format: formatSchema.default("reel"),
  platforms: z.array(platformSchema).min(1).default(["instagram", "tiktok"]),
  hook: z.string().trim().min(1).max(400),
  angle: z.string().trim().max(600).default(""),
  cta: z.string().trim().max(200).default(""),
  status: z.enum(["idea", "scripted", "filmed", "edited", "scheduled", "posted"]).default("scripted"),
  source: z.enum(["script", "manual"]).default("script"),
  scriptPath: z
    .string()
    .regex(/^content\/scripts\/[\w.-]+\.md$/, "scriptPath must be content/scripts/<file>.md")
    .optional(),
  script: z.string().max(20_000).optional(),
  captions: z.partialRecord(platformSchema, z.string().max(2200)).optional(),
});

export const updatePostSchema = z.object({
  id: z.string(),
  captions: z.partialRecord(platformSchema, z.string().max(2200)),
  media: z.array(z.url()).max(10),
});
