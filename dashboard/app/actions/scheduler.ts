"use server";

import { revalidatePath } from "next/cache";
import { getCalendar, getScheduled, mutate, newId } from "@/lib/store";
import { calendarEntryInputSchema, updatePostSchema } from "@/lib/schemas";
import { generateCaptions } from "@/lib/ai";
import { approvalKey, approvalProblems, entryInstant, READY_STATUSES } from "@/lib/posts";
import type { CalendarEntry, ScheduledPost } from "@/lib/types";

type Result = { ok: boolean; message: string };

function refresh() {
  revalidatePath("/scheduler");
  revalidatePath("/calendar");
}

async function draftPost(entry: CalendarEntry, rewrite = false): Promise<{ post: ScheduledPost; note?: string }> {
  // captions Claude already wrote in /script — free, no API key
  const fromScript = !rewrite && entry.captions && entry.platforms.every((p) => entry.captions?.[p]?.trim());
  const { captions, source, error } = fromScript
    ? { captions: entry.captions!, source: "script" as const, error: undefined }
    : await generateCaptions({
    title: entry.title,
    hook: entry.hook,
    angle: entry.angle,
    cta: entry.cta,
    format: entry.format,
    platforms: entry.platforms,
  });
  return {
    post: {
      id: newId("post"),
      calendarEntryId: entry.id,
      title: entry.title,
      format: entry.format,
      platforms: entry.platforms,
      scheduledFor: entryInstant(entry),
      captions,
      media: [],
      status: "pending_approval",
      captionSource: source,
      createdAt: new Date().toISOString(),
    },
    note: error,
  };
}

/** One click: Claude writes the captions and the post waits for your approval. */
export async function scheduleEntryAction(entryId: string): Promise<Result> {
  const [{ entries }, { posts }] = await Promise.all([getCalendar(), getScheduled()]);
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return { ok: false, message: "calendar entry not found" };
  if (posts.some((p) => p.calendarEntryId === entryId)) return { ok: false, message: "already in the scheduler" };
  const { post } = await draftPost(entry);
  await mutate("scheduled", (f) => {
    f.posts.push(post);
  });
  await mutate("calendar", (f) => {
    const e = f.entries.find((x) => x.id === entryId);
    if (e) e.status = "scheduled";
  });
  refresh();
  return {
    ok: true,
    message:
      post.captionSource === "script"
        ? "drafted with the captions /script wrote — add media, then approve"
        : post.captionSource === "claude"
          ? "captions written by claude — add media, then approve"
          : "drafted from a template — edit the captions (or ask claude in /script), add media, then approve",
  };
}

export async function scheduleAllReadyAction(): Promise<Result> {
  const [{ entries }, { posts }] = await Promise.all([getCalendar(), getScheduled()]);
  const today = new Date().toISOString().slice(0, 10);
  const ready = entries.filter((e) => READY_STATUSES.includes(e.status) && e.date >= today && !posts.some((p) => p.calendarEntryId === e.id));
  let n = 0;
  for (const e of ready) if ((await scheduleEntryAction(e.id)).ok) n++;
  return { ok: true, message: n ? `drafted ${n} post${n === 1 ? "" : "s"} for your approval` : "nothing ready to schedule" };
}

export async function updatePostAction(input: unknown): Promise<Result> {
  const parsed = updatePostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "check the post" };
  const { id, captions, media } = parsed.data;
  const msg = await mutate("scheduled", (f) => {
    const p = f.posts.find((x) => x.id === id);
    if (!p) return "post not found";
    if (p.status === "published" || p.status === "publishing") return "already published";
    const captionsChanged = p.platforms.some((k) => (p.captions[k] ?? "") !== (captions[k] ?? ""));
    p.captions = Object.fromEntries(p.platforms.map((k) => [k, captions[k] ?? ""]));
    p.media = media;
    if (captionsChanged) p.captionSource = "edited";
    // any change after approval needs a fresh approval
    if (p.status === "approved" && p.approvalKey !== approvalKey(p)) {
      Object.assign(p, { status: "pending_approval", approvedAt: undefined, approvalKey: undefined });
      return "saved — edits need a fresh approval";
    }
    return "saved";
  });
  refresh();
  return { ok: msg.startsWith("saved"), message: msg };
}

export async function regenerateCaptionsAction(id: string): Promise<Result> {
  const [{ posts }, { entries }] = await Promise.all([getScheduled(), getCalendar()]);
  const post = posts.find((p) => p.id === id);
  const entry = entries.find((e) => e.id === post?.calendarEntryId);
  if (!post || !entry) return { ok: false, message: "post not found" };
  const { post: fresh } = await draftPost(entry, true);
  await mutate("scheduled", (f) => {
    const p = f.posts.find((x) => x.id === id);
    if (p) Object.assign(p, { captions: fresh.captions, captionSource: fresh.captionSource, status: "pending_approval", approvedAt: undefined, approvalKey: undefined });
  });
  refresh();
  return { ok: true, message: fresh.captionSource === "claude" ? "new captions written by claude" : "reset to the template captions" };
}

/** Your authorisation. Saves the current edits and approves them in one step. */
export async function approvePostAction(input: unknown): Promise<Result> {
  const saved = await updatePostAction(input);
  if (!saved.ok) return saved;
  const id = (input as { id: string }).id;
  const msg = await mutate("scheduled", (f) => {
    const p = f.posts.find((x) => x.id === id);
    if (!p) return "post not found";
    const problems = approvalProblems(p);
    if (problems.length) return problems.join(" · ");
    Object.assign(p, { status: "approved", approvedAt: new Date().toISOString(), approvalKey: approvalKey(p) });
    return "approved";
  });
  refresh();
  return { ok: msg === "approved", message: msg === "approved" ? "approved — it publishes at the scheduled time" : msg };
}

export async function unapprovePostAction(id: string): Promise<Result> {
  await mutate("scheduled", (f) => {
    const p = f.posts.find((x) => x.id === id);
    if (p && p.status === "approved") Object.assign(p, { status: "pending_approval", approvedAt: undefined, approvalKey: undefined });
  });
  refresh();
  return { ok: true, message: "approval withdrawn" };
}

export async function retryPostAction(id: string): Promise<Result> {
  await mutate("scheduled", (f) => {
    const p = f.posts.find((x) => x.id === id);
    // failed platforms are retried with the same approved content; succeeded ones are kept
    if (p && p.status === "failed") p.status = "approved";
  });
  refresh();
  return { ok: true, message: "queued to retry the failed platforms" };
}

export async function removePostAction(id: string): Promise<Result> {
  const removed = await mutate("scheduled", (f) => {
    const p = f.posts.find((x) => x.id === id);
    if (!p || p.status === "publishing" || p.status === "published") return null;
    f.posts = f.posts.filter((x) => x.id !== id);
    return p;
  });
  if (removed) {
    await mutate("calendar", (f) => {
      const e = f.entries.find((x) => x.id === removed.calendarEntryId);
      if (e && e.status === "scheduled") e.status = "edited";
    });
  }
  refresh();
  return { ok: !!removed, message: removed ? "removed from the scheduler" : "can't remove a published post" };
}

/** Quick post that skips /script: adds a calendar entry, ready to schedule. */
export async function newEntryAction(_prev: Result, form: FormData): Promise<Result> {
  const parsed = calendarEntryInputSchema.safeParse({
    date: form.get("date"),
    time: form.get("time"),
    title: form.get("title"),
    format: form.get("format"),
    platforms: form.getAll("platforms"),
    hook: form.get("hook"),
    angle: form.get("angle") ?? "",
    cta: form.get("cta") ?? "",
    status: "edited",
    source: "manual",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "check the form" };
  await mutate("calendar", (f) => {
    f.entries.push({ ...parsed.data, id: newId("cal") });
    f.entries.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  });
  refresh();
  return { ok: true, message: "added — schedule it below" };
}
