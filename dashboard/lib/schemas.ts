/** zod schemas for everything that enters through a form or an API route. */
import { z } from "zod";

export const platformSchema = z.enum(["instagram", "tiktok", "youtube", "linkedin", "x"]);
export const hookFormatSchema = z.enum(["curiosity", "contrarian", "listicle", "story", "pov", "how-to", "result-first", "callout"]);

export const newHookSchema = z.object({
  transcript: z.string().trim().min(3).max(600),
  template: z.string().trim().max(600).optional(),
  format: hookFormatSchema.optional(),
  creator: z.string().trim().min(1).max(80),
  platform: platformSchema,
  url: z.url().optional().or(z.literal("").transform(() => undefined)),
  views: z.coerce.number().int().nonnegative().optional(),
  tags: z.array(z.string().trim().min(1)).max(10).default([]),
});

export const calendarEntryInputSchema = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(160),
  hook: z.string().trim().min(1).max(400),
  angle: z.string().trim().max(400).default(""),
  platforms: z.array(platformSchema).min(1).default(["instagram", "tiktok"]),
  status: z.enum(["idea", "scripted", "filmed", "edited", "posted"]).default("scripted"),
  source: z.enum(["script", "manual"]).default("script"),
  scriptPath: z.string().optional(),
});

export const captionRequestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  brief: z.string().trim().max(2000).default(""),
  platforms: z.array(platformSchema).min(1),
});

export const schedulePostSchema = z.object({
  title: z.string().trim().min(1).max(160),
  brief: z.string().trim().max(2000).default(""),
  scheduledFor: z.iso.datetime({ offset: true }).or(z.iso.datetime({ local: true })),
  platforms: z.array(platformSchema).min(1),
  captions: z.partialRecord(platformSchema, z.string().max(3000)),
});
