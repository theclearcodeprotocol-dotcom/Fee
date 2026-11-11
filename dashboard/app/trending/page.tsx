import type { Metadata } from "next";
import { getTrending } from "@/lib/store";
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
        description={`ai news from ${sources.length} sources, each tagged for hook potential with a first line you could film today.`}
      />
      <DataSourceNote meta={meta} />
      <TrendFeed sources={sources} items={items} sample={meta.sample} />
    </>
  );
}
