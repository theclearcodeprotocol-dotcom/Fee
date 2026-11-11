import type { Metadata } from "next";
import { getTrending } from "@/lib/store";
import { topHookItems } from "@/lib/hook-potential";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { TrendFeed } from "./trend-feed";

export const metadata: Metadata = { title: "what's trending" };
export const dynamic = "force-dynamic";

export default async function TrendingPage() {
  const { meta, sources, items } = await getTrending();
  return (
    <>
      <PageHeader
        title="what's trending"
        description={`ai news from ${sources.length} sources, pulled daily and tagged “hook potential”, “explainer” or “skip”. the top 5 hook-worthy stories go to slack at 7am.`}
      />
      <DataSourceNote meta={meta} />
      <TrendFeed sources={sources} items={items} top={topHookItems(items)} sample={meta.sample} />
    </>
  );
}
