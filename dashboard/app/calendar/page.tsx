import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCalendar, getScheduled } from "@/lib/store";
import { loadScript } from "@/lib/scripts";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CalendarGrid, type Slot } from "./calendar-grid";

export const metadata: Metadata = { title: "content calendar" };
export const dynamic = "force-dynamic";

function parseMonth(value: string | undefined) {
  const m = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : { year: now.getFullYear(), month: now.getMonth() };
}
const key = (y: number, m: number) => {
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonth(monthParam);
  const [{ meta, entries }, { posts }] = await Promise.all([getCalendar(), getScheduled()]);
  const prefix = key(year, month);
  const slots: Slot[] = await Promise.all(
    entries
      .filter((e) => e.date.startsWith(prefix))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      .map(async (entry) => ({ entry, script: await loadScript(entry), post: posts.find((p) => p.calendarEntryId === entry.id) ?? null })),
  );
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(year, month, 1));

  return (
    <>
      <PageHeader
        title="content calendar"
        description="when each piece goes out, where, and the hook. click any slot for the full script and caption."
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
      <CalendarGrid year={year} month={month} slots={slots} />
    </>
  );
}
