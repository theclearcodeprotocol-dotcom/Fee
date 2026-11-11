/**
 * Save a hook from a video file: ElevenLabs transcribes the opening, the first
 * sentence becomes the hook, and it's templated (Claude, or the built-in
 * rules) and saved to the hook vault.
 *
 *   npm run hooks:transcribe -- <video> --creator @handle [--niche "ai tools"] [--platform instagram|tiktok] [--url …] [--views 120000]
 */
import { transcribeOpening, hookFromWords, framesAt, withTempDir } from "../lib/media.ts";
import { createHook } from "../lib/hooks.ts";
import { readOnScreenText } from "../lib/ai.ts";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const input = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const creator = flag("creator");
if (!input || !creator) {
  console.error('usage: npm run hooks:transcribe -- <video> --creator @handle [--niche "ai tools"] [--platform instagram] [--url …] [--views N]');
  process.exit(1);
}

await withTempDir(async (dir) => {
  const file = join(dir, "clip");
  await copyFile(input, file);
  const { text, words } = await transcribeOpening(file);
  const transcript = hookFromWords(words, text);
  if (!transcript) throw new Error("no speech found in the first seconds");
  const onScreenText = await readOnScreenText(framesAt(file)).catch(() => "");
  const { hook, templatedBy } = await createHook({
    transcript,
    creator,
    niche: flag("niche"),
    platform: flag("platform") === "tiktok" ? "tiktok" : "instagram",
    url: flag("url"),
    views: flag("views") ? Number(flag("views")) : undefined,
    onScreenText,
  });
  console.log(`saved ${hook.id}\n  hook:     “${hook.transcript}”\n  template: ${hook.template} (${templatedBy})\n  niche:    ${hook.niche}`);
});
