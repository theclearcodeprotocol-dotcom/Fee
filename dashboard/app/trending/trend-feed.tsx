"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Flame } from "lucide-react";
import type { HookPotential, TrendItem, TrendSource } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const POTENTIAL: Record<HookPotential, { label: string; className: string }> = {
  high: { label: "high hook potential", className: "bg-primary text-primary-foreground" },
  medium: { label: "medium", className: "bg-secondary text-secondary-foreground" },
  low: { label: "low", className: "bg-muted text-muted-foreground" },
};

function CopyHook({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "copied" : "copy hook"}
    </Button>
  );
}

export function TrendFeed({ sources, items, sample }: { sources: TrendSource[]; items: TrendItem[]; sample: boolean }) {
  const [potential, setPotential] = useState<HookPotential | "all">("all");
  const [source, setSource] = useState<string | null>(null);
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    items.forEach((i) => c.set(i.sourceId, (c.get(i.sourceId) ?? 0) + 1));
    return c;
  }, [items]);

  const visible = items
    .filter((i) => (potential === "all" || i.potential === potential) && (!source || i.sourceId === source))
    .sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
      <div className="min-w-0 space-y-4">
        <Tabs value={potential} onValueChange={(v) => setPotential(v as HookPotential | "all")}>
          <TabsList>
            <TabsTrigger value="all">all {items.length}</TabsTrigger>
            {(["high", "medium", "low"] as const).map((p) => (
              <TabsTrigger key={p} value={p}>
                {p === "high" ? <Flame /> : null}
                {p} {items.filter((i) => i.potential === p).length}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {visible.length === 0 ? <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">nothing matches these filters.</p> : null}

        <div className="grid gap-3">
          {visible.map((item) => (
            <Card key={item.id} className="gap-3 py-4">
              <CardHeader className="px-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("rounded-full px-2 py-0.5 font-medium", POTENTIAL[item.potential].className)}>
                    {POTENTIAL[item.potential].label} · {item.score}
                  </span>
                  <span>{sourceName(item.sourceId)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDate(item.publishedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  {sample ? <Badge variant="outline">sample</Badge> : null}
                </div>
                <CardTitle className="mt-1 text-xl">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 sm:px-5">
                <p className="text-sm text-muted-foreground">{item.summary}</p>
                <div className="rounded-lg border-l-4 border-primary bg-secondary/50 p-3">
                  <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">hook idea</p>
                  <p className="mt-0.5 font-medium">{item.hookIdea}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((t) => (
                      <Badge key={t} variant="muted">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex">
                    <CopyHook text={item.hookIdea} />
                    <Button variant="ghost" size="sm" asChild>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <ExternalLink /> {sample ? "source" : "read"}
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="h-fit xl:sticky xl:top-6">
        <CardHeader>
          <CardTitle>{sources.length} sources</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1">
          <button
            onClick={() => setSource(null)}
            className={cn("flex justify-between rounded-md px-2 py-1.5 text-left text-sm", !source ? "bg-secondary font-medium text-secondary-foreground" : "hover:bg-muted")}
          >
            all sources <span className="tabular-nums">{items.length}</span>
          </button>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => setSource(source === s.id ? null : s.id)}
              aria-pressed={source === s.id}
              className={cn(
                "flex justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                source === s.id ? "bg-secondary font-medium text-secondary-foreground" : "hover:bg-muted",
              )}
            >
              <span className="truncate">{s.name}</span>
              <span className="tabular-nums text-muted-foreground">{counts.get(s.id) ?? 0}</span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
