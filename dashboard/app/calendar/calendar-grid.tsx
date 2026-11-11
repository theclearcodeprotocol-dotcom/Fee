"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { PLATFORMS, type CalendarEntry, type CalendarStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_STYLE: Record<CalendarStatus, string> = {
  idea: "bg-muted text-muted-foreground",
  scripted: "bg-secondary text-secondary-foreground",
  filmed: "bg-chart-3 text-primary",
  edited: "bg-chart-2 text-brand-ink",
  posted: "bg-primary text-primary-foreground",
};
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function CalendarGrid({ year, month, entries }: { year: number; month: number; entries: CalendarEntry[] }) {
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // weeks start on monday
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => i - lead + 1);
  const today = new Date().toISOString().slice(0, 10);
  const byDay = new Map<number, CalendarEntry[]>();
  entries.forEach((e) => {
    const d = Number(e.date.slice(8, 10));
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  });
  const iso = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(Object.keys(STATUS_STYLE) as CalendarStatus[]).map((s) => (
          <span key={s} className={cn("rounded-full px-2.5 py-0.5", STATUS_STYLE[s])}>
            {s}
          </span>
        ))}
      </div>

      {/* desktop: month grid */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="grid grid-cols-7 border-b bg-muted/60">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d >= 1 && d <= daysInMonth;
            const isToday = inMonth && iso(d) === today;
            return (
              <div key={i} className={cn("min-h-32 border-b border-r p-2 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/30")}>
                {inMonth ? (
                  <>
                    <span
                      suppressHydrationWarning
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs",
                        isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {d}
                    </span>
                    <div className="mt-1 grid gap-1">
                      {(byDay.get(d) ?? []).map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setSelected(e)}
                          className={cn("rounded-md px-2 py-1 text-left text-xs leading-tight transition-opacity hover:opacity-85", STATUS_STYLE[e.status])}
                        >
                          <span className="line-clamp-2 font-medium">{e.title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* mobile: agenda list */}
      <div className="grid gap-2 md:hidden">
        {entries.length === 0 ? <p className="text-muted-foreground">nothing planned this month.</p> : null}
        {entries.map((e) => (
          <button key={e.id} onClick={() => setSelected(e)} className="flex min-w-0 gap-3 rounded-xl border bg-card p-3 text-left">
            <span className="font-heading w-12 shrink-0 text-center text-primary">
              <span className="block text-2xl leading-none">{Number(e.date.slice(8))}</span>
              <span className="text-xs">{formatDate(e.date, { weekday: "short" }).toLowerCase()}</span>
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{e.title}</span>
              <span className="block truncate text-sm text-muted-foreground">{e.hook}</span>
              <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs", STATUS_STYLE[e.status])}>{e.status}</span>
            </span>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  {formatDate(selected.date, { weekday: "long", day: "numeric", month: "long" }).toLowerCase()} ·{" "}
                  {selected.source === "script" ? "from /script" : "added by hand"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 text-sm">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">hook</p>
                  <p className="font-heading text-xl leading-snug text-primary">“{selected.hook}”</p>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">angle</p>
                  <p>{selected.angle || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs", STATUS_STYLE[selected.status])}>{selected.status}</span>
                  {selected.platforms.map((p) => (
                    <Badge key={p} variant="outline">
                      {PLATFORMS.find((x) => x.id === p)?.label}
                    </Badge>
                  ))}
                </div>
                {selected.scriptPath ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="size-4" aria-hidden /> <code className="text-xs">{selected.scriptPath}</code>
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
