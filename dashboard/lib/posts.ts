/** Scheduler rules shared by the app and scripts/publish-due.ts. */
import { createHash } from "node:crypto";
import { PLATFORMS, type CalendarEntry, type ScheduledPost } from "./types.ts";

/**
 * Fingerprint of everything that would go out. Taken at approval; the
 * publisher refuses any post whose fingerprint has changed since, so an edit
 * after approval always needs a fresh approval.
 */
export function approvalKey(p: Pick<ScheduledPost, "captions" | "media" | "scheduledFor" | "platforms" | "format">) {
  const body = JSON.stringify({
    f: p.format,
    t: p.scheduledFor,
    p: [...p.platforms].sort(),
    c: [...p.platforms].sort().map((k) => p.captions[k] ?? ""),
    m: p.media,
  });
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
}

/** Problems that block approval. Empty array = ready. */
export function approvalProblems(p: ScheduledPost, now = new Date()): string[] {
  const problems: string[] = [];
  for (const id of p.platforms) {
    const meta = PLATFORMS.find((x) => x.id === id)!;
    const text = p.captions[id]?.trim() ?? "";
    if (!text) problems.push(`${meta.label} caption is empty`);
    else if (text.length > meta.captionLimit) problems.push(`${meta.label} caption is over ${meta.captionLimit} characters`);
  }
  if (p.format === "reel" && p.media.length !== 1) problems.push("a reel needs exactly one video url");
  if (p.format === "carousel" && (p.media.length < 2 || p.media.length > 10)) problems.push("a carousel needs 2–10 image urls");
  if (new Date(p.scheduledFor).getTime() <= now.getTime()) problems.push("the post time is in the past — move it in the calendar");
  return problems;
}

/**
 * Calendar date + time → instant. Times are the creator's local wall-clock
 * time, interpreted in the server's timezone (set TZ to override, e.g.
 * TZ=Europe/London).
 */
export function entryInstant(e: Pick<CalendarEntry, "date" | "time">) {
  return new Date(`${e.date}T${e.time}:00`).toISOString();
}

export const READY_STATUSES: CalendarEntry["status"][] = ["scripted", "filmed", "edited"];
