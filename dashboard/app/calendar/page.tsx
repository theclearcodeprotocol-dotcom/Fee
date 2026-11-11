import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Terminal } from "lucide-react";
import { getCalendar } from "@/lib/store";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CalendarGrid } from "./calendar-grid";

export const metadata: Metadata = { title: "content calendar" };
export const dynamic = "force-dynamic";

function parseMonth(value: string | undefined) {
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}
const key = (y: number, m: number) => {
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonth(monthParam);
  const { meta, entries } = await getCalendar();
  const prefix = key(year, month);
  const monthEntries = entries.filter((e) => e.date.startsWith(prefix));
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(year, month, 1));
  const counts = {
    script: monthEntries.filter((e) => e.source === "script").length,
    total: monthEntries.length,
  };

  return (
    <>
      <PageHeader
        title="content calendar"
        description="filled automatically by /script — every script lands here with its hook and angle."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" asChild>
              <Link href={`/calendar?month=${key(year, month - 1)}`} aria-label="Previous month">
                <ChevronLeft />
              </Link>
            </Button>
            <span className="font-heading min-w-40 text-center text-xl text-primary">{label.toLowerCase()}</span>
            <Button variant="outline" size="icon" asChild>
              <Link href={`/calendar?month=${key(year, month + 1)}`} aria-label="Next month">
                <ChevronRight />
              </Link>
            </Button>
          </div>
        }
      />
      <DataSourceNote meta={meta} />
      <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Terminal className="size-4" aria-hidden />
        {counts.total} pieces this month, {counts.script} from /script. run <code className="rounded bg-muted px-1.5">/script &lt;topic&gt;</code> in
        claude code to add one.
      </p>
      <CalendarGrid year={year} month={month} entries={monthEntries} />
    </>
  );
}
