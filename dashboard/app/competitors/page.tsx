import type { Metadata } from "next";
import { getCompetitors, getHooks } from "@/lib/store";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { CompetitorReels } from "./competitor-reels";

export const metadata: Metadata = { title: "competitor tracker" };
export const dynamic = "force-dynamic";

export default async function CompetitorsPage() {
  const [{ meta, creators, reels }, { hooks }] = await Promise.all([getCompetitors(), getHooks()]);
  const saved = new Set(hooks.flatMap((h) => (h.sourceReelId ? [h.sourceReelId] : [])));
  const rows = reels
    .map((r) => {
      const c = creators.find((c) => c.handle === r.creator);
      return { ...r, followers: c?.followers ?? 0, creatorName: c?.name ?? r.creator, saved: saved.has(r.id) };
    })
    .sort((a, b) => b.views - a.views);

  return (
    <>
      <PageHeader
        title="competitor tracker"
        description={`the top 5 reels from each of the ${creators.length} accounts you follow, scraped every sunday at 06:00 — transcribed, with the hook and on-screen text pulled out.`}
      />
      <DataSourceNote meta={meta} />
      <CompetitorReels rows={rows} creators={creators} />
    </>
  );
}
