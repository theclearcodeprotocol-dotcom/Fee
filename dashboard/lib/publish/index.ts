import type { Platform, ScheduledPost } from "../types.ts";
import { publishInstagram } from "./instagram.ts";
import { publishTikTok } from "./tiktok.ts";

export const PUBLISHERS: Record<Platform, (post: ScheduledPost) => Promise<string>> = {
  instagram: publishInstagram,
  tiktok: publishTikTok,
};
