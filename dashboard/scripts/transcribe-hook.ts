/**
 * Save a hook from a video file: ElevenLabs Scribe transcribes it, the first
 * sentence (inside the first ~8 seconds) becomes the hook, and it is posted to
 * the running dashboard, which templates it with Claude.
 *
 *   npm run hooks:transcribe -- <video> --creator @handle [--platform instagram] [--url https://…] [--views 120000]
 *
 * Needs ffmpeg for video input, and the dev server running (default
 * http://localhost:3000, override with --api). Auth for api.elevenlabs.io:
 * ELEVENLABS_API_KEY locally; added by the network proxy in Fee cloud sessions.
 */
import { readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { basename, extname, join } from "node:path";
import { tmpdir } from "node:os";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const input = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const creator = flag("creator");
if (!input || !creator) {
  console.error("usage: npm run hooks:transcribe -- <video> --creator @handle [--platform instagram] [--url …] [--views N]");
  process.exit(1);
}
const api = flag("api") ?? "http://localhost:3000";

let upload = input;
let tmp: string | undefined;
if (![".mp3", ".wav", ".m4a", ".ogg", ".flac"].includes(extname(input).toLowerCase())) {
  tmp = join(tmpdir(), `hook-stt-${process.pid}.mp3`);
  // only the opening matters for a hook — keep the upload tiny
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-t", "12", "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", tmp]);
  upload = tmp;
}

const form = new FormData();
form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v1");
form.append("timestamps_granularity", "word");
form.append("tag_audio_events", "false");
form.append("file", new Blob([await readFile(upload)]), basename(upload));

const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
  method: "POST",
  headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "proxy-injected" },
  body: form,
});
if (tmp) await rm(tmp, { force: true });
if (!res.ok) {
  console.error(`ElevenLabs error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = (await res.json()) as { text?: string; words?: { text: string; start: number; end: number; type: string }[] };

// Hook = words up to the first sentence end, capped at 8 seconds.
const words = (data.words ?? []).filter((w) => w.type === "word" && w.start <= 8);
let hook = "";
for (const w of words) {
  hook += (hook ? " " : "") + w.text.trim();
  if (/[.!?]$/.test(w.text) && w.end >= 1.5) break;
}
hook = hook.trim() || (data.text ?? "").split(/(?<=[.!?])\s/)[0];
console.log(`hook: “${hook}”`);

const post = await fetch(`${api}/api/hooks`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    transcript: hook,
    creator,
    platform: flag("platform") ?? "instagram",
    url: flag("url") ?? "",
    views: flag("views") ? Number(flag("views")) : undefined,
    tags: [],
  }),
}).catch((e: Error) => {
  console.error(`couldn't reach the dashboard at ${api} (${e.message}). start it with npm run dev.`);
  process.exit(1);
});
const out = await post.json();
if (!post.ok) {
  console.error(out);
  process.exit(1);
}
console.log(`saved ${out.hook.id} — template (${out.templatedBy}): ${out.hook.template}`);
