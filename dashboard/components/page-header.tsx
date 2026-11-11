import type { DataMeta } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Info } from "lucide-react";

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-4xl leading-[0.95] text-primary sm:text-5xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Shown whenever a page's data file still holds generated sample data. */
export function DataSourceNote({ meta }: { meta: DataMeta }) {
  const updated = formatDate(meta.updatedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  if (!meta.sample) {
    return <p className="mb-6 text-xs text-muted-foreground">source: {meta.source} · updated {updated} UTC</p>;
  }
  return (
    <div role="note" className="mb-6 flex items-start gap-2 rounded-lg border border-primary/20 bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-medium">sample data.</strong> nothing here is real yet — {meta.source}.
      </span>
    </div>
  );
}
