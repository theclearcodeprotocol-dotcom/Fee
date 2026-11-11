import type { Metadata } from "next";
import { getCompetitors } from "@/lib/store";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompact } from "@/lib/utils";
import { CompetitorReels } from "./competitor-reels";

export const metadata: Metadata = { title: "competitive tracker" };
export const dynamic = "force-dynamic";

export default async function CompetitorsPage() {
  const { meta, creators, reels } = await getCompetitors();
  const rows = reels
    .map((r) => {
      const c = creators.find((c) => c.handle === r.creator);
      return { ...r, multiple: c ? r.views / c.medianViews : 1, creatorName: c?.name ?? r.creator };
    })
    .sort((a, b) => b.multiple - a.multiple);

  return (
    <>
      <PageHeader
        title="competitive tracker"
        description="the top reels from creators you track, scraped every monday. sorted by outlier score — views against that creator's own median."
      />
      <DataSourceNote meta={meta} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {creators.map((c) => {
          const best = rows.find((r) => r.creator === c.handle);
          return (
            <Card key={c.handle} className="gap-1 py-4">
              <CardHeader className="px-4">
                <CardTitle className="truncate text-base">{c.name}</CardTitle>
                <CardDescription className="truncate text-xs">{c.handle}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 text-xs text-muted-foreground">
                <p>
                  {formatCompact(c.followers)} followers · {c.niche}
                </p>
                <p>median {formatCompact(c.medianViews)} views</p>
                {best ? <p className="mt-1 font-medium text-primary">best this week: {best.multiple.toFixed(1)}×</p> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CompetitorReels rows={rows} creators={creators.map((c) => ({ handle: c.handle, name: c.name }))} />
    </>
  );
}
