/**
 * Instagram Content Publishing API (Graph API, Instagram professional account).
 *   reel:     POST /{ig-user-id}/media  media_type=REELS, video_url, caption
 *   carousel: POST /{ig-user-id}/media  image_url, is_carousel_item=true   (per image)
 *             POST /{ig-user-id}/media  media_type=CAROUSEL, children, caption
 *   then wait for the container's status_code = FINISHED and
 *   POST /{ig-user-id}/media_publish  creation_id
 * Media must be at public HTTPS URLs Instagram can fetch.
 *
 * Env: IG_USER_ID, IG_ACCESS_TOKEN (needs instagram_content_publish),
 * IG_GRAPH_VERSION (default v23.0). IG_GRAPH_BASE overrides the host (tests).
 */
import type { ScheduledPost } from "../types.ts";

const base = () => `${process.env.IG_GRAPH_BASE ?? "https://graph.facebook.com"}/${process.env.IG_GRAPH_VERSION ?? "v23.0"}`;

async function graph(path: string, params: Record<string, string>, method: "GET" | "POST" = "POST") {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("IG_ACCESS_TOKEN is not set");
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${base()}${path}${method === "GET" ? `?${qs}` : ""}`, {
    method,
    ...(method === "POST" ? { body: qs } : {}),
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; status_code?: string; error?: { message?: string } };
  if (!res.ok || data.error) throw new Error(`instagram ${path}: ${data.error?.message ?? `HTTP ${res.status}`}`);
  return data;
}

async function waitUntilFinished(containerId: string, timeoutMs = 10 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { status_code } = await graph(`/${containerId}`, { fields: "status_code" }, "GET");
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`instagram container ${containerId}: ${status_code}`);
    if (Date.now() > deadline) throw new Error(`instagram container ${containerId}: still ${status_code} after ${timeoutMs / 1000}s`);
    await new Promise((r) => setTimeout(r, Number(process.env.PUBLISH_POLL_MS ?? 5000)));
  }
}

export async function publishInstagram(post: ScheduledPost): Promise<string> {
  const user = process.env.IG_USER_ID;
  if (!user) throw new Error("IG_USER_ID is not set");
  const caption = post.captions.instagram ?? "";
  let container: string;
  if (post.format === "reel") {
    container = (await graph(`/${user}/media`, { media_type: "REELS", video_url: post.media[0], caption, share_to_feed: "true" })).id!;
  } else {
    const children: string[] = [];
    for (const image_url of post.media) children.push((await graph(`/${user}/media`, { image_url, is_carousel_item: "true" })).id!);
    container = (await graph(`/${user}/media`, { media_type: "CAROUSEL", children: children.join(","), caption })).id!;
  }
  await waitUntilFinished(container);
  return (await graph(`/${user}/media_publish`, { creation_id: container })).id!;
}
