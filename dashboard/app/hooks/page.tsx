import type { Metadata } from "next";
import { getHooks } from "@/lib/store";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { HookVault } from "./hook-vault";
import { AddHookDialog } from "./add-hook-dialog";

export const metadata: Metadata = { title: "hook vault" };
export const dynamic = "force-dynamic";

export default async function HooksPage() {
  const { meta, hooks } = await getHooks();
  return (
    <>
      <PageHeader
        title="hook vault"
        description="every viral hook you save — transcribed with elevenlabs, turned into a template you can reuse."
        actions={<AddHookDialog />}
      />
      <DataSourceNote meta={meta} />
      <HookVault hooks={hooks} />
    </>
  );
}
