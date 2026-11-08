#!/usr/bin/env node
// Transcribe audio/video with ElevenLabs Speech-to-Text (Scribe) and import the
// word-level result into this HyperFrames project as transcript.json.
//
// Usage: node scripts/elevenlabs-transcribe.mjs <media-file> [--language en] [--speakers]
//
// Auth: in Claude Code cloud sessions the network proxy adds the saved key for
// api.elevenlabs.io. Locally, set ELEVENLABS_API_KEY.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { basename, extname, join } from "node:path";
import { tmpdir } from "node:os";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--language");
if (!input) {
  console.error("Usage: node scripts/elevenlabs-transcribe.mjs <media-file> [--language en] [--speakers]");
  process.exit(1);
}
const langIdx = args.indexOf("--language");
const language = langIdx >= 0 ? args[langIdx + 1] : undefined;
const speakers = args.includes("--speakers");
const model = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";

// Send audio only: extract a small mono mp3 from video so uploads stay fast.
let upload = input;
let tmp;
if (![".mp3", ".wav", ".m4a", ".ogg", ".flac"].includes(extname(input).toLowerCase())) {
  tmp = join(tmpdir(), `el-stt-${process.pid}.mp3`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", tmp]);
  upload = tmp;
}

const form = new FormData();
form.append("model_id", model);
form.append("timestamps_granularity", "word");
form.append("tag_audio_events", "false");
if (speakers) form.append("diarize", "true");
if (language) form.append("language_code", language);
form.append("file", new Blob([await readFile(upload)]), basename(upload));

const headers = {};
headers["xi-api-key"] = process.env.ELEVENLABS_API_KEY || "proxy-injected";

const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers, body: form });
if (tmp) await rm(tmp, { force: true });
if (!res.ok) {
  console.error(`ElevenLabs error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = await res.json();

const words = (data.words || [])
  .filter((w) => w.type === "word")
  .map((w) => ({ text: w.text, start: w.start, end: w.end, ...(speakers && w.speaker_id ? { speaker: w.speaker_id } : {}) }));

await mkdir("ai-video-editing/transcripts", { recursive: true });
const stem = basename(input, extname(input));
const raw = `ai-video-editing/transcripts/${stem}.elevenlabs.json`;
const wordsPath = `ai-video-editing/transcripts/${stem}.words.json`;
await writeFile(raw, JSON.stringify(data, null, 2));
await writeFile(wordsPath, JSON.stringify(words, null, 2));
console.log(`ElevenLabs: ${words.length} words, language ${data.language_code ?? "?"}`);
console.log(`Raw response: ${raw}\nWord timings: ${wordsPath}`);

// Import into the HyperFrames project (writes transcript.json).
execFileSync("npx", ["--yes", "hyperframes@0.9.25", "transcribe", wordsPath], { stdio: "inherit" });
