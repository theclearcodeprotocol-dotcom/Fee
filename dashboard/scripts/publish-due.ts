/**
 * Publish approved posts whose time has come. Runs every 5 minutes from the
 * schedule installed by scripts/install-schedule.sh.
 *
 *   npm run publish:due              # publish what's due
 *   npm run publish:due -- --dry-run # only list what would go out
 *
 * Safety rules (the approval gate):
 *  - only posts with status "approved" are considered;
 *  - the post's fingerprint must match the one taken at approval — any edit
 *    to captions, media, time or platforms since then sends it back to
 *    "pending_approval" instead of publishing;
 *  - each platform is published once; a retry only re-attempts platforms that failed.
 */
import { read, mutate } from "../lib/store.ts";
import { approvalKey } from "../lib/posts.ts";
import { PUBLISHERS } from "../lib/publish/index.ts";
import type { PublishResult, ScheduledPost } from "../lib/types.ts";

const dryRun = process.argv.includes("--dry-run");
const now = new Date();

const { posts } = await read("scheduled");
const due = posts.filter((p) => p.status === "approved" && new Date(p.scheduledFor) <= now);
if (!due.length) {
  console.log(`${now.toISOString()} nothing due`);
  process.exit(0);
}

for (const post of due) {
  if (post.approvalKey !== approvalKey(post)) {
    console.warn(`${post.id} changed after approval — sent back for approval, not published`);
    if (!dryRun) {
      await mutate("scheduled", (f) => {
        const p = f.posts.find((x) => x.id === post.id);
        if (p) Object.assign(p, { status: "pending_approval", approvedAt: undefined, approvalKey: undefined });
      });
    }
    continue;
  }
  const todo = post.platforms.filter((p) => !post.results?.[p]?.ok);
  console.log(`${dryRun ? "[dry run] would publish" : "publishing"} ${post.id} “${post.title}” (${post.format}) → ${todo.join(", ")}`);
  if (dryRun) continue;

  await mutate("scheduled", (f) => {
    const p = f.posts.find((x) => x.id === post.id);
    if (p) p.status = "publishing";
  });

  const results: Partial<Record<keyof typeof PUBLISHERS, PublishResult>> = { ...post.results };
  for (const platform of todo) {
    try {
      const id = await PUBLISHERS[platform](post);
      results[platform] = { ok: true, id, at: new Date().toISOString() };
      console.log(`  ✓ ${platform} ${id}`);
    } catch (e) {
      results[platform] = { ok: false, error: (e as Error).message, at: new Date().toISOString() };
      console.error(`  ✗ ${platform}: ${(e as Error).message}`);
    }
  }
  const allOk = post.platforms.every((p) => results[p]?.ok);

  await mutate("scheduled", (f) => {
    const p = f.posts.find((x) => x.id === post.id) as ScheduledPost | undefined;
    if (!p) return;
    p.results = results;
    p.status = allOk ? "published" : "failed";
  });
  if (allOk) {
    await mutate("calendar", (f) => {
      const e = f.entries.find((x) => x.id === post.calendarEntryId);
      if (e) e.status = "posted";
    });
  }
}
