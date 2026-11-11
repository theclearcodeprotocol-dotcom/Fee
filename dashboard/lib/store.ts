/**
 * File-backed data store. Every page reads its data through here, and every
 * writer (server actions, API routes, scheduled jobs) writes the same files.
 *
 * Decision: plain JSON files in /data instead of a database — a single-user,
 * local-first tool whose data Claude skills and Node scripts can write without
 * a client library. To move to a database, re-implement this file.
 *
 * Paths resolve from process.cwd(), so run the app and the scripts from the
 * dashboard/ folder (npm scripts and scripts/install-schedule.sh do).
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AnalyticsFile,
  CalendarEntry,
  CompetitorsFile,
  DataMeta,
  Hook,
  ScheduledPost,
  ScriptQueueItem,
  TrendingFile,
} from "./types.ts";

export const DATA_DIR = join(process.cwd(), "data");

export type HooksFile = { meta: DataMeta; hooks: Hook[] };
export type ScheduledFile = { meta: DataMeta; posts: ScheduledPost[] };
export type CalendarFile = { meta: DataMeta; entries: CalendarEntry[] };
export type ScriptQueueFile = { queue: ScriptQueueItem[] };

type Files = {
  hooks: HooksFile;
  analytics: AnalyticsFile;
  "analytics-tiktok": AnalyticsFile;
  competitors: CompetitorsFile;
  scheduled: ScheduledFile;
  calendar: CalendarFile;
  trending: TrendingFile;
  "script-queue": ScriptQueueFile;
};

export async function read<K extends keyof Files>(name: K): Promise<Files[K]> {
  return JSON.parse(await readFile(join(DATA_DIR, `${name}.json`), "utf8")) as Files[K];
}

/** Atomic write: temp file + rename, so a crash never leaves half a JSON file. */
export async function write<K extends keyof Files>(name: K, value: Files[K]) {
  const file = join(DATA_DIR, `${name}.json`);
  const tmp = `${file}.${process.pid}.${randomUUID().slice(0, 6)}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n");
  await rename(tmp, file);
}

// Serialise read-modify-write per file inside one process (server actions can overlap).
const queues = new Map<string, Promise<unknown>>();
export function mutate<K extends keyof Files, R = void>(name: K, fn: (file: Files[K]) => R | Promise<R>): Promise<R> {
  const run = (queues.get(name) ?? Promise.resolve()).then(async () => {
    const file = await read(name);
    const result = await fn(file);
    await write(name, file);
    return result;
  });
  queues.set(name, run.catch(() => undefined));
  return run;
}

export const getHooks = () => read("hooks");
export const getAnalytics = (platform: "instagram" | "tiktok" = "instagram") => read(platform === "tiktok" ? "analytics-tiktok" : "analytics");
export const getCompetitors = () => read("competitors");
export const getScheduled = () => read("scheduled");
export const getCalendar = () => read("calendar");
export const getTrending = () => read("trending");
export const getScriptQueue = () => read("script-queue");

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

