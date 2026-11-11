/**
 * Adding competitor reels by hand or from screenshots — the free route when
 * Metricool's plan has no competitor tracking. Shared by the "add reel" form
 * and `npm run competitors:add` (used by the /competitors skill).
 */
import { mutate, newId } from "./store.ts";
import type { CompetitorReel } from "./types.ts";
import type { CompetitorReelInput } from "./schemas.ts";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function addCompetitorReels(inputs: CompetitorReelInput[]): Promise<{ added: number; updated: number }> {
  return mutate("competitors", (file) => {
    // the first real reel replaces the generated sample data
    if (file.meta.sample) {
      file.creators = [];
      file.reels = [];
    }
    let added = 0;
    let updated = 0;
    for (const r of inputs) {
      const handle = r.creator.toLowerCase();
      let creator = file.creators.find((c) => c.handle.toLowerCase() === handle);
      if (!creator) {
        creator = { handle: r.creator, name: (r.creatorName ?? r.creator.replace(/^@/, "")).toLowerCase(), niche: r.niche ?? "", followers: r.followers ?? 0 };
        file.creators.push(creator);
      } else {
        if (r.followers) creator.followers = r.followers;
        if (r.niche && !creator.niche) creator.niche = r.niche;
        if (r.creatorName) creator.name = r.creatorName.toLowerCase();
      }
      // same reel again (same link, or same creator + hook) → update the numbers
      const existing = file.reels.find(
        (x) => (r.url && x.url === r.url) || (x.creator.toLowerCase() === handle && norm(x.hook) === norm(r.hook)),
      );
      const reel: CompetitorReel = {
        id: existing?.id ?? newId("comp"),
        creator: creator.handle,
        hook: r.hook,
        onScreenText: r.onScreenText ?? existing?.onScreenText,
        transcript: existing?.transcript,
        caption: r.caption ?? existing?.caption ?? "",
        views: r.views ?? existing?.views,
        likes: r.likes ?? existing?.likes ?? 0,
        comments: r.comments ?? existing?.comments ?? 0,
        postedAt: r.postedAt ? new Date(r.postedAt).toISOString() : (existing?.postedAt ?? new Date().toISOString()),
        url: r.url ?? existing?.url,
        source: r.source,
        dateKnown: r.postedAt ? true : (existing?.dateKnown ?? false),
      };
      if (existing) {
        Object.assign(existing, reel);
        updated++;
      } else {
        file.reels.push(reel);
        added++;
      }
    }
    file.meta = { sample: false, source: "screenshots and manual entries (free route)", updatedAt: new Date().toISOString() };
    return { added, updated };
  });
}

export async function removeCompetitorReel(id: string) {
  await mutate("competitors", (file) => {
    file.reels = file.reels.filter((r) => r.id !== id);
  });
}
