/**
 * Add competitor reels from a JSON file — used by the /competitors skill after
 * Claude reads screenshots of competitors' Instagram reels tabs.
 *
 *   npm run competitors:add -- path/to/reels.json
 *
 * The file is an array of objects (see competitorReelInputSchema in lib/schemas.ts):
 *   [{ "creator": "@handle", "followers": 12500, "hook": "…", "onScreenText": "…",
 *      "views": 48000, "likes": 900, "url": "https://www.instagram.com/reel/…",
 *      "source": "screenshot" }]
 * Re-adding a reel (same link, or same account + hook) updates its numbers.
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { competitorReelInputSchema } from "../lib/schemas.ts";
import { addCompetitorReels } from "../lib/competitors.ts";

const path = process.argv[2];
if (!path) {
  console.error("usage: npm run competitors:add -- <reels.json>");
  process.exit(1);
}
const parsed = z.array(competitorReelInputSchema).safeParse(JSON.parse(await readFile(path, "utf8")));
if (!parsed.success) {
  console.error(parsed.error.issues.slice(0, 5));
  process.exit(1);
}
const { added, updated } = await addCompetitorReels(parsed.data);
console.log(`added ${added}, updated ${updated} competitor reels`);
