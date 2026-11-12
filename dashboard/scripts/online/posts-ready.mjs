/**
 * `/metricool send`, step 2. Reads the dashboard's posts (saved by ArtifactData
 * list with out_dir, one <id>.json per post) and prints the ones ready to send:
 * status "approved", fingerprint unchanged since approval, time still ahead,
 * real media links. Output: JSON list of { postId, platform, title, blogId, date, info }
 * — `date` and `info` go to Metricool's createScheduledPost unchanged.
 * Posts edited after approval are listed separately under "stale" so Claude can
 * send them back to "pending_approval".
 *
 *   node scripts/online/posts-ready.mjs <dir-with-post-json-files>
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { approvalKey } from "./approval-key.mjs";

const BRAND = "7976989", TZ = "Europe/London";
const dir = process.argv[2];
if (!dir) { console.error("usage: node scripts/online/posts-ready.mjs <posts dir>"); process.exit(1); }

function zoned(iso) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "longOffset" }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const offset = parts.timeZoneName === "GMT" ? "+00:00" : parts.timeZoneName.replace("GMT", "");
  const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  return { local, iso: local + offset };
}
function info(p, platform) {
  return {
    autoPublish: true, descendants: [], draft: false, firstCommentText: "", hasNotReadNotes: false,
    media: p.media, mediaAltText: [], providers: [{ network: platform }],
    publicationDate: { dateTime: zoned(p.scheduledFor).local, timezone: TZ },
    shortener: false, smartLinkData: { ids: [] }, text: p.captions[platform] ?? "",
    ...(platform === "instagram"
      ? { instagramData: { type: p.format === "reel" ? "REEL" : "POST", showReelOnFeed: true } }
      // Metricool refuses a TikTok post without tiktokData.title; for a TikTok video the title is
      // its caption, so it is the approved TikTok caption, unchanged.
      : { tiktokData: { title: (p.captions[platform] ?? "").slice(0, 2200), privacyOption: "PUBLIC_TO_EVERYONE", disableComment: false, disableDuet: false, disableStitch: false, autoAddMusic: p.format === "carousel", photoCoverIndex: 0 } }),
  };
}

const ready = [], stale = [], skipped = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const p = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const id = p.id || f.replace(/\.json$/, "");
  if (p.status !== "approved") continue;
  if (p.approvalKey !== approvalKey(p)) { stale.push(id); continue; }
  if (new Date(p.scheduledFor).getTime() <= Date.now()) { skipped.push(`${id} “${p.title}”: its time has passed`); continue; }
  if ((p.media || []).some((m) => !/^https:\/\//.test(m) || /(^|\.)example\.(com|org)\//.test(new URL(m).host + "/"))) { skipped.push(`${id} “${p.title}”: a media link isn't a real https link`); continue; }
  for (const platform of p.platforms) {
    if (p.results?.[platform]?.ok) continue;
    ready.push({ postId: id, platform, title: p.title, blogId: BRAND, date: zoned(p.scheduledFor).iso, info: JSON.stringify(info(p, platform)) });
  }
}
console.log(JSON.stringify({ ready, stale, skipped }, null, 2));
