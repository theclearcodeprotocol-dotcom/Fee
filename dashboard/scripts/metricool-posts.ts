/**
 * The scheduler's hand-off to Metricool, used by `/metricool send`.
 *
 *   npm run -s metricool:posts -- ready
 *       → JSON list of { postId, platform, title, blogId, date, info } for every
 *         post you APPROVED whose content is unchanged since approval and whose
 *         time is still ahead. `date` and `info` are exactly what Metricool's
 *         createScheduledPost takes. Posts edited after approval are sent back
 *         for approval instead (never listed).
 *   npm run -s metricool:posts -- mark <postId> <platform> <metricoolPostId> <plannerUrl>
 *   npm run -s metricool:posts -- skip <postId> <platform> "<reason>"
 *       → record the outcome; when every platform is handled the post becomes
 *         "in_metricool" and Metricool publishes it at its time.
 */
import { mutate, read } from "../lib/store.ts";
import { approvalKey } from "../lib/posts.ts";
import { METRICOOL, zoned } from "../lib/metricool.ts";
import type { Platform, ScheduledPost } from "../lib/types.ts";

const [cmd, ...args] = process.argv.slice(2);

function info(post: ScheduledPost, platform: Platform) {
  const { local } = zoned(post.scheduledFor);
  return {
    autoPublish: true,
    descendants: [],
    draft: false,
    firstCommentText: "",
    hasNotReadNotes: false,
    media: post.media,
    mediaAltText: [],
    providers: [{ network: platform }],
    publicationDate: { dateTime: local, timezone: METRICOOL.timezone },
    shortener: false,
    smartLinkData: { ids: [] },
    text: post.captions[platform] ?? "",
    ...(platform === "instagram"
      ? { instagramData: { type: post.format === "reel" ? "REEL" : "POST", showReelOnFeed: true } }
      : {
          tiktokData: {
            privacyOption: "PUBLIC_TO_EVERYONE",
            disableComment: false,
            disableDuet: false,
            disableStitch: false,
            autoAddMusic: post.format === "carousel",
            photoCoverIndex: 0,
          },
        }),
  };
}

function settle(p: ScheduledPost) {
  const handled = p.platforms.every((k) => p.results?.[k]);
  const anyOk = p.platforms.some((k) => p.results?.[k]?.ok);
  if (handled && anyOk) p.status = "in_metricool";
}

if (cmd === "ready") {
  const now = Date.now();
  const { meta, posts } = await read("scheduled");
  if (meta.sample) {
    // never send the generated sample posts to the real Metricool account
    console.error("the scheduler still holds SAMPLE posts — run `npm run data:clear-sample` first, then approve real ones");
    console.log("[]");
    process.exit(0);
  }
  const out: unknown[] = [];
  const stale: string[] = [];
  for (const p of posts) {
    if (p.status !== "approved") continue;
    if (p.approvalKey !== approvalKey(p)) {
      stale.push(p.id);
      continue;
    }
    if (p.media.some((m) => /(^|\.)example\.(com|org)\//.test(new URL(m).host + "/"))) {
      console.error(`skipping ${p.id} “${p.title}”: placeholder media link`);
      continue;
    }
    if (new Date(p.scheduledFor).getTime() <= now) {
      console.error(`skipping ${p.id} “${p.title}”: its time has passed — move it in the calendar and re-approve`);
      continue;
    }
    for (const platform of p.platforms) {
      if (p.results?.[platform]?.ok) continue;
      out.push({ postId: p.id, platform, title: p.title, blogId: METRICOOL.brandId, date: zoned(p.scheduledFor).isoWithOffset, info: JSON.stringify(info(p, platform)) });
    }
  }
  if (stale.length) {
    await mutate("scheduled", (f) => {
      for (const p of f.posts) if (stale.includes(p.id)) Object.assign(p, { status: "pending_approval", approvedAt: undefined, approvalKey: undefined });
    });
    console.error(`sent back for approval (edited after approval): ${stale.join(", ")}`);
  }
  console.log(JSON.stringify(out, null, 2));
} else if (cmd === "mark" || cmd === "skip") {
  const [postId, platform, a, b] = args as [string, Platform, string, string];
  if (!postId || !platform || !a) {
    console.error("usage: mark <postId> <platform> <metricoolPostId> <plannerUrl>  |  skip <postId> <platform> <reason>");
    process.exit(1);
  }
  const ok = await mutate("scheduled", (f) => {
    const p = f.posts.find((x) => x.id === postId);
    if (!p) return false;
    p.results = {
      ...p.results,
      [platform]: cmd === "mark" ? { ok: true, id: a, url: b, at: new Date().toISOString() } : { ok: false, error: a, at: new Date().toISOString() },
    };
    settle(p);
    return true;
  });
  console.log(ok ? `${cmd === "mark" ? "marked" : "skipped"} ${postId} ${platform}` : `post ${postId} not found`);
  if (!ok) process.exit(1);
} else {
  console.error("usage: ready | mark … | skip …");
  process.exit(1);
}
