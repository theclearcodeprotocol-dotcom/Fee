"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import type { CalendarEntry, CalendarStatus, Platform, ScheduledPost } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PlatformBadges } from "@/components/platform-badges";

export type Slot = { entry: CalendarEntry; script: string | null; post: ScheduledPost | null };

const STATUS_STYLE: Record<CalendarStatus, string> = {
  idea: "bg-muted text-muted-foreground",
  scripted: "bg-secondary text-secondary-foreground",
  filmed: "bg-chart-3 text-primary",
  edited: "bg-chart-2 text-brand-ink",
  scheduled: "bg-primary/85 text-primary-foreground",
  posted: "bg-primary text-primary-foreground",
};
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SHORT: Record<Platform, string> = { instagram: "IG", tiktok: "TT" };

function PlatformTags({ platforms, className }: { platforms: Platform[]; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)}>
      {platforms.map((p) => (
        <span key={p} className="rounded bg-black/10 px-1 text-[0.6rem] font-semibold leading-4" title={p === "instagram" ? "Instagram" : "TikTok"}>
          {SHORT[p]}
        </span>
      ))}
    </span>
  );
}

/** Minimal markdown for scripts: ## headings, numbered/bulleted lines, paragraphs. */
function ScriptBody({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split("\n");
        const heading = lines[0].match(/^#{1,3}\s+(.*)$/);
        return (
          <div key={i}>
            {heading ? <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-wider text-primary">{heading[1]}</p> : null}
            {(heading ? lines.slice(1) : lines).filter(Boolean).map((l, j) => (
              <p key={j} className="whitespace-pre-wrap">
                {l}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SidePanel({ slot, onClose }: { slot: Slot | null; onClose: () => void }) {
  const e = slot?.entry;
  return (
    <Sheet open={!!slot} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-[100vw] overflow-y-auto bg-card sm:w-[30rem] sm:max-w-[30rem]">
        {e ? (
          <div className="space-y-6 p-6">
            <div className="pr-8">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                {formatDate(e.date, { weekday: "long", day: "numeric", month: "long" }).toLowerCase()} · {e.time}
              </p>
              <SheetTitle className="font-heading mt-1 text-3xl leading-tight text-primary">{e.title}</SheetTitle>
              <SheetDescription className="mt-2 flex flex-wrap items-center gap-2">
                <PlatformBadges platforms={e.platforms} format={e.format} />
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs", STATUS_STYLE[e.status])}>{e.status}</span>
                <span className="text-xs">{e.source === "script" ? "from /script" : "added by hand"}</span>
              </SheetDescription>
            </div>

            <dl className="grid gap-3 rounded-xl bg-secondary/50 p-4">
              <div>
                <dt className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">hook</dt>
                <dd className="font-heading text-xl leading-snug text-primary">“{e.hook}”</dd>
              </div>
              <div>
                <dt className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">angle</dt>
                <dd className="text-sm">{e.angle || "—"}</dd>
              </div>
              <div>
                <dt className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">cta</dt>
                <dd className="text-sm">{e.cta || "—"}</dd>
              </div>
            </dl>

            <section>
              <h3 className="text-xl text-primary">script</h3>
              {e.scriptPath ? (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="size-3.5" aria-hidden /> <code>{e.scriptPath}</code>
                </p>
              ) : null}
              {slot.script ? <ScriptBody text={slot.script} /> : <p className="text-sm text-muted-foreground">no script yet — run /script for this one.</p>}
            </section>

            <section>
              <h3 className="text-xl text-primary">caption</h3>
              {slot.post ? (
                <div className="mt-2 space-y-3">
                  <p className="text-xs text-muted-foreground">status in the scheduler: {slot.post.status.replace("_", " ")}</p>
                  {slot.post.platforms.map((p) => (
                    <div key={p}>
                      <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{p === "instagram" ? "Instagram" : "TikTok"}</p>
                      <p className="whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm">{slot.post!.captions[p] || "—"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">no caption yet — it’s written when you schedule this in the scheduler.</p>
              )}
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function CalendarGrid({ year, month, slots }: { year: number; month: number; slots: Slot[] }) {
  const [selected, setSelected] = useState<Slot | null>(null);
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // weeks start on monday
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => i - lead + 1);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const byDay = new Map<number, Slot[]>();
  slots.forEach((s) => {
    const d = Number(s.entry.date.slice(8, 10));
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  });
  const iso = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {(Object.keys(STATUS_STYLE) as CalendarStatus[]).map((s) => (
          <span key={s} className={cn("rounded-full px-2.5 py-0.5", STATUS_STYLE[s])}>
            {s}
          </span>
        ))}
        <span className="ml-1 text-muted-foreground">IG = Instagram · TT = TikTok</span>
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
            return (
              <div key={i} className={cn("min-h-36 min-w-0 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/30")}>
                {inMonth ? (
                  <>
                    <span
                      suppressHydrationWarning
                      className={cn(
                        "ml-0.5 inline-flex size-6 items-center justify-center rounded-full text-xs",
                        iso(d) === today ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {d}
                    </span>
                    <div className="mt-1 grid gap-1">
                      {(byDay.get(d) ?? []).map((s) => (
                        <button
                          key={s.entry.id}
                          onClick={() => setSelected(s)}
                          className={cn(
                            "w-full rounded-md px-1.5 py-1 text-left text-xs leading-tight transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            STATUS_STYLE[s.entry.status],
                          )}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span className="font-semibold tabular-nums">{s.entry.time}</span>
                            <PlatformTags platforms={s.entry.platforms} />
                          </span>
                          <span className="mt-0.5 line-clamp-3">{s.entry.hook}</span>
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
        {slots.length === 0 ? <p className="text-muted-foreground">nothing planned this month.</p> : null}
        {slots.map((s) => (
          <button key={s.entry.id} onClick={() => setSelected(s)} className="flex min-w-0 gap-3 rounded-xl border bg-card p-3 text-left">
            <span className="font-heading w-12 shrink-0 text-center text-primary">
              <span className="block text-2xl leading-none">{Number(s.entry.date.slice(8))}</span>
              <span className="text-xs">{formatDate(s.entry.date, { weekday: "short" }).toLowerCase()}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">{s.entry.time}</span>
                <PlatformBadges platforms={s.entry.platforms} />
              </span>
              <span className="mt-1 block text-sm font-medium">{s.entry.hook}</span>
              <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-xs", STATUS_STYLE[s.entry.status])}>{s.entry.status}</span>
            </span>
          </button>
        ))}
      </div>

      <SidePanel slot={selected} onClose={() => setSelected(null)} />
    </>
  );
}
