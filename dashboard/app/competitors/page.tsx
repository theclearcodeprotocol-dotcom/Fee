import type { Metadata } from "next";
import { getCompetitors, getHooks } from "@/lib/store";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { CompetitorReels } from "./competitor-reels";
import { AddReelDialog } from "./add-reel-dialog";

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
    .sort((a, b) => (b.views ?? b.likes) - (a.views ?? a.likes));
  const fromMetricool = reels.some((r) => r.source === "metricool");

  return (
    <>
      <PageHeader
        title="competitor tracker"
        description={
          fromMetricool
            ? `top reels from the ${creators.length} accounts you track in metricool, ranked by likes (metricool doesn’t share competitors’ views).`
            : `top reels from the ${creators.length} accounts you track, sorted by views. screenshot a competitor’s reels tab and send it to claude with /competitors, or add one by hand.`
        }
        actions={<AddReelDialog handles={creators.map((c) => c.handle)} />}
      />
      <DataSourceNote meta={meta} />
      <CompetitorReels rows={rows} creators={creators} />
    </>
  );
}
