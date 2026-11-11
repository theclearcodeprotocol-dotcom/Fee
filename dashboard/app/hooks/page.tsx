import type { Metadata } from "next";
import { getHooks, getScriptQueue } from "@/lib/store";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { HookVault } from "./hook-vault";
import { AddHookDialog } from "./add-hook-dialog";

export const metadata: Metadata = { title: "hook vault" };
export const dynamic = "force-dynamic";

export default async function HooksPage() {
  const [{ meta, hooks }, { queue }] = await Promise.all([getHooks(), getScriptQueue()]);
  const niches = [...new Set(hooks.map((h) => h.niche))].sort();
  return (
    <>
      <PageHeader
        title="hook vault"
        description="every hook you save, transcribed and turned into a template. hit “use this” to send one to /script."
        actions={<AddHookDialog niches={niches} />}
      />
      <DataSourceNote meta={meta} />
      <HookVault hooks={hooks} queued={queue.map((q) => q.hookId)} />
    </>
  );
}
