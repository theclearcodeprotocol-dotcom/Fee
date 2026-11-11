/**
 * File-backed data store. Every page reads its data through here, and every
 * writer (server actions, API routes, /script, scrapers) writes the same files.
 *
 * Decision: plain JSON files in /data instead of a database. This is a
 * single-user, local-first tool; JSON keeps the data diffable in git and
 * trivially writable by Claude commands and Node scripts. To move to a
 * database, re-implement these functions — nothing else touches the files.
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type {
  AnalyticsFile,
  CalendarEntry,
  CompetitorsFile,
  DataMeta,
  Hook,
  ScheduledPost,
  TrendingFile,
} from "./types";

const DATA_DIR = join(process.cwd(), "data");

async function read<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(join(DATA_DIR, `${name}.json`), "utf8")) as T;
}

/** Atomic write: temp file + rename, so a crash never leaves half a JSON file. */
async function write(name: string, value: unknown) {
  const file = join(DATA_DIR, `${name}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n");
  await rename(tmp, file);
}

type HooksFile = { meta: DataMeta; hooks: Hook[] };
type ScheduledFile = { meta: DataMeta; posts: ScheduledPost[] };
type CalendarFile = { meta: DataMeta; entries: CalendarEntry[] };

export const getHooks = () => read<HooksFile>("hooks");
export const getAnalytics = () => read<AnalyticsFile>("analytics");
export const getCompetitors = () => read<CompetitorsFile>("competitors");
export const getScheduled = () => read<ScheduledFile>("scheduled");
export const getCalendar = () => read<CalendarFile>("calendar");
export const getTrending = () => read<TrendingFile>("trending");

export async function addHook(hook: Hook) {
  const file = await getHooks();
  file.hooks.unshift(hook);
  await write("hooks", file);
}

export async function deleteHook(id: string) {
  const file = await getHooks();
  file.hooks = file.hooks.filter((h) => h.id !== id);
  await write("hooks", file);
}

export async function addScheduledPost(post: ScheduledPost) {
  const file = await getScheduled();
  file.posts.push(post);
  file.posts.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  await write("scheduled", file);
}

export async function deleteScheduledPost(id: string) {
  const file = await getScheduled();
  file.posts = file.posts.filter((p) => p.id !== id);
  await write("scheduled", file);
}

export async function upsertCalendarEntries(entries: CalendarEntry[]) {
  const file = await getCalendar();
  for (const entry of entries) {
    const i = file.entries.findIndex((e) => e.id === entry.id);
    if (i >= 0) file.entries[i] = entry;
    else file.entries.push(entry);
  }
  file.entries.sort((a, b) => a.date.localeCompare(b.date));
  await write("calendar", file);
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
