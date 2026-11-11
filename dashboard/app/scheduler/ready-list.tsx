"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import type { CalendarEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { scheduleAllReadyAction, scheduleEntryAction } from "@/app/actions/scheduler";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlatformBadges } from "@/components/platform-badges";

export function ScheduleAllButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button disabled={pending || count === 0} onClick={() => start(async () => setMsg((await scheduleAllReadyAction()).message))}>
        <Sparkles /> {pending ? "claude is drafting…" : `schedule all ready (${count})`}
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  );
}

function ReadyRow({ entry }: { entry: CalendarEntry }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <li className="grid gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
      <div className="text-sm">
        <p className="font-medium text-primary">{formatDate(entry.date, { weekday: "short", day: "numeric", month: "short" }).toLowerCase()}</p>
        <p className="text-muted-foreground">{entry.time}</p>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="font-heading text-lg leading-snug text-primary">{entry.title}</p>
        <p className="truncate text-sm text-muted-foreground">“{entry.hook}”</p>
        <PlatformBadges platforms={entry.platforms} format={entry.format} />
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <Button variant="secondary" disabled={pending} onClick={() => start(async () => setMsg((await scheduleEntryAction(entry.id)).message))}>
          <Sparkles /> {pending ? "drafting…" : "schedule with claude"}
        </Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </li>
  );
}

export function ReadyList({ entries }: { entries: CalendarEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">nothing ready. run /script or add a post.</p>;
  return (
    <Card className="gap-0 py-0">
      <ul>
        {entries.map((e) => (
          <ReadyRow key={e.id} entry={e} />
        ))}
      </ul>
    </Card>
  );
}
