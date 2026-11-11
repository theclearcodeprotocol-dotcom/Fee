/**
 * `/competitors`, step 3: merge new reels (read from screenshots) into the
 * dashboard's competitors/state document.
 *
 *   node scripts/online/competitors-merge.mjs <state.json> <new-reels.json> > merged.json
 *
 * new-reels.json: [{ creator: "@handle", creatorName?, followers?, niche?, hook,
 *   onScreenText?, views?, likes?, comments?, url?, postedAt? }]
 * Same reel again (same link, or same account + hook) updates its numbers.
 */
import { readFileSync } from "node:fs";
const [statePath, newPath] = process.argv.slice(2);
if (!statePath || !newPath) { console.error("usage: competitors-merge.mjs <state.json> <new.json>"); process.exit(1); }
const st = JSON.parse(readFileSync(statePath, "utf8"));
const inputs = JSON.parse(readFileSync(newPath, "utf8"));
st.creators ||= []; st.reels ||= [];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const rid = () => "comp_" + Math.random().toString(36).slice(2, 10);
let added = 0, updated = 0;
for (const r of inputs) {
  const handle = "@" + String(r.creator).replace(/^@/, "");
  let c = st.creators.find((x) => x.handle.toLowerCase() === handle.toLowerCase());
  if (!c) { c = { handle, name: (r.creatorName || handle.slice(1)).toLowerCase(), niche: r.niche || "", followers: r.followers || 0 }; st.creators.push(c); }
  else { if (r.followers) c.followers = r.followers; if (r.niche && !c.niche) c.niche = r.niche; if (r.creatorName) c.name = r.creatorName.toLowerCase(); }
  const ex = st.reels.find((x) => (r.url && x.url === r.url) || (x.creator.toLowerCase() === handle.toLowerCase() && norm(x.hook) === norm(r.hook)));
  const reel = {
    id: ex?.id || rid(), creator: c.handle, hook: r.hook, onScreenText: r.onScreenText ?? ex?.onScreenText, transcript: ex?.transcript,
    caption: r.caption ?? ex?.caption ?? "", views: r.views ?? ex?.views, likes: r.likes ?? ex?.likes ?? 0, comments: r.comments ?? ex?.comments ?? 0,
    postedAt: r.postedAt ? new Date(r.postedAt).toISOString() : ex?.postedAt ?? new Date().toISOString(),
    dateKnown: r.postedAt ? true : ex?.dateKnown ?? false, url: r.url ?? ex?.url, source: "screenshot",
  };
  for (const k of Object.keys(reel)) if (reel[k] === undefined) delete reel[k];
  if (ex) { Object.assign(ex, reel); updated++; } else { st.reels.push(reel); added++; }
}
st.meta = { sample: false, source: "screenshots and manual entries", updatedAt: new Date().toISOString() };
process.stdout.write(JSON.stringify(st));
console.error(`added ${added}, updated ${updated}`);
