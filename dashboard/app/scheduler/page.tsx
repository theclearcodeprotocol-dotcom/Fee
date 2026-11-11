import type { Metadata } from "next";
import { getScheduled } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Composer } from "./composer";
import { Queue } from "./queue";

export const metadata: Metadata = { title: "scheduler" };
export const dynamic = "force-dynamic";

export default async function SchedulerPage() {
  const { posts } = await getScheduled();
  return (
    <>
      <PageHeader
        title="scheduler"
        description="write the brief once, generate a caption for every platform, schedule them all in one click."
      />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Composer />
        </div>
        <div className="xl:col-span-2">
          <Queue posts={posts} />
        </div>
      </div>
    </>
  );
}
