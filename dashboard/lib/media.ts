/**
 * Media helpers for the scheduled jobs (plain Node, never imported by the app):
 * download a video, transcribe its opening with ElevenLabs Scribe, and grab
 * frames from the first seconds for on-screen text reading.
 *
 * Needs ffmpeg on PATH. ElevenLabs auth: ELEVENLABS_API_KEY (the network proxy
 * adds it in Fee cloud sessions).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Word {
  text: string;
  start: number;
  end: number;
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "ccd-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function download(url: string, to: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  await writeFile(to, Buffer.from(await res.arrayBuffer()));
}

/** Transcribe the first `seconds` of a media file. */
export async function transcribeOpening(file: string, seconds = 15): Promise<{ text: string; words: Word[] }> {
  const mp3 = `${file}.opening.mp3`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-t", String(seconds), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", mp3]);
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v1");
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  form.append("file", new Blob([await readFile(mp3)]), "opening.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "proxy-injected" },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { text?: string; words?: (Word & { type: string })[] };
  return {
    text: (data.text ?? "").trim(),
    words: (data.words ?? []).filter((w) => w.type === "word").map(({ text, start, end }) => ({ text, start, end })),
  };
}

/** The hook = spoken words up to the first sentence end, capped at 8 seconds. */
export function hookFromWords(words: Word[], fallbackText = ""): string {
  let hook = "";
  for (const w of words.filter((w) => w.start <= 8)) {
    hook += (hook ? " " : "") + w.text.trim();
    if (/[.!?]$/.test(w.text) && w.end >= 1.5) break;
  }
  return hook.trim() || fallbackText.split(/(?<=[.!?])\s/)[0] || "";
}

/** JPEG frames at the given timestamps (seconds), scaled to 720px wide. */
export function framesAt(file: string, times = [0.4, 1.2, 2.5]): Buffer[] {
  return times.flatMap((t, i) => {
    const out = `${file}.f${i}.jpg`;
    try {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "4", out]);
      return [readFileSync(out)];
    } catch {
      return []; // video shorter than t
    }
  });
}
