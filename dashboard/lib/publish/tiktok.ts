/**
 * TikTok Content Posting API (direct post).
 *   creator info: POST /v2/post/publish/creator_info/query/
 *   reel:         POST /v2/post/publish/video/init/    source PULL_FROM_URL
 *   carousel:     POST /v2/post/publish/content/init/  media_type PHOTO, post_mode DIRECT_POST
 *   status:       POST /v2/post/publish/status/fetch/  until PUBLISH_COMPLETE
 *
 * Requirements (TikTok's, not ours):
 *  - an app with the video.publish scope and a user access token (TIKTOK_ACCESS_TOKEN)
 *  - PULL_FROM_URL media must be on a domain verified in the TikTok developer portal
 *  - until TikTok audits the app, posts can only be private (SELF_ONLY)
 *
 * Privacy: TIKTOK_PRIVACY_LEVEL if set, else PUBLIC_TO_EVERYONE when the
 * account allows it, else the first option TikTok offers.
 * TIKTOK_API_BASE overrides the host (tests).
 */
import type { ScheduledPost } from "../types.ts";

const base = () => process.env.TIKTOK_API_BASE ?? "https://open.tiktokapis.com";

async function tiktok<T>(path: string, body: unknown): Promise<T> {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) throw new Error("TIKTOK_ACCESS_TOKEN is not set");
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(60_000),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string } };
  if (!res.ok || (json.error?.code && json.error.code !== "ok")) {
    throw new Error(`tiktok ${path}: ${json.error?.message || json.error?.code || `HTTP ${res.status}`}`);
  }
  return json.data as T;
}

async function privacyLevel() {
  if (process.env.TIKTOK_PRIVACY_LEVEL) return process.env.TIKTOK_PRIVACY_LEVEL;
  const info = await tiktok<{ privacy_level_options?: string[] }>("/v2/post/publish/creator_info/query/", {});
  const options = info.privacy_level_options ?? [];
  return options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : (options[0] ?? "SELF_ONLY");
}

async function waitForPublish(publishId: string, timeoutMs = 10 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { status, fail_reason } = await tiktok<{ status: string; fail_reason?: string }>("/v2/post/publish/status/fetch/", { publish_id: publishId });
    if (status === "PUBLISH_COMPLETE") return;
    if (status === "FAILED") throw new Error(`tiktok publish failed: ${fail_reason ?? "unknown"}`);
    if (Date.now() > deadline) throw new Error(`tiktok publish ${publishId}: still ${status}`);
    await new Promise((r) => setTimeout(r, Number(process.env.PUBLISH_POLL_MS ?? 5000)));
  }
}

export async function publishTikTok(post: ScheduledPost): Promise<string> {
  const caption = post.captions.tiktok ?? "";
  const privacy_level = await privacyLevel();
  let publishId: string;
  if (post.format === "reel") {
    ({ publish_id: publishId } = await tiktok<{ publish_id: string }>("/v2/post/publish/video/init/", {
      post_info: { title: caption, privacy_level, disable_comment: false, disable_duet: false, disable_stitch: false },
      source_info: { source: "PULL_FROM_URL", video_url: post.media[0] },
    }));
  } else {
    ({ publish_id: publishId } = await tiktok<{ publish_id: string }>("/v2/post/publish/content/init/", {
      post_info: { title: caption.split("\n")[0].slice(0, 90), description: caption, privacy_level, disable_comment: false, auto_add_music: true },
      source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: post.media },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    }));
  }
  await waitForPublish(publishId);
  return publishId;
}
