/**
 * Empty every data file that still holds sample data, so only real data shows.
 * Keeps the tracked creators list and the 12 trend sources.
 *
 *   npm run data:clear-sample
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "data");
const LISTS: Record<string, string[]> = {
  hooks: ["hooks"],
  analytics: ["daily", "reels"],
  competitors: ["reels"],
  scheduled: ["posts"],
  calendar: ["entries"],
  trending: ["items"],
};

for (const [name, keys] of Object.entries(LISTS)) {
  const path = join(DIR, `${name}.json`);
  const file = JSON.parse(await readFile(path, "utf8"));
  if (!file.meta?.sample) {
    console.log(`kept data/${name}.json (already real data)`);
    continue;
  }
  for (const k of keys) file[k] = [];
  file.meta = { sample: false, source: "cleared — waiting for real data", updatedAt: new Date().toISOString() };
  await writeFile(path, JSON.stringify(file, null, 2) + "\n");
  console.log(`cleared data/${name}.json`);
}
