"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Flame } from "lucide-react";
import type { TrendItem, TrendSource, TrendTag } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAG_STYLE: Record<TrendTag, string> = {
  "hook potential": "bg-primary text-primary-foreground",
  explainer: "bg-secondary text-secondary-foreground",
  skip: "bg-muted text-muted-foreground",
};
const when = (iso: string) => formatDate(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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

export function TrendFeed({ sources, items, top, sample }: { sources: TrendSource[]; items: TrendItem[]; top: TrendItem[]; sample: boolean }) {
  const [tag, setTag] = useState<TrendTag | "all">("all");
  const [source, setSource] = useState<string | null>(null);
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name ?? id;

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    items.forEach((i) => c.set(i.sourceId, (c.get(i.sourceId) ?? 0) + 1));
    return c;
  }, [items]);

  const visible = items
    .filter((i) => (tag === "all" || i.tag === tag) && (!source || i.sourceId === source))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return (
    <div className="space-y-8">
      <section aria-labelledby="top5">
        <h2 id="top5" className="mb-3 flex items-center gap-2 text-2xl text-primary">
          <Flame className="size-5" aria-hidden /> top 5 hook-worthy, newest first
        </h2>
        {top.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">nothing tagged “hook potential” in this pull.</p>
        ) : (
          <ol className="grid gap-3">
            {top.map((item, i) => (
              <li key={item.id} className="grid gap-3 rounded-xl bg-primary p-4 text-primary-foreground sm:grid-cols-[2.5rem_1fr_auto] sm:p-5">
                <span aria-hidden className="font-heading text-3xl leading-none text-brand-pink">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-xs text-brand-cream/75">
                    {sourceName(item.sourceId)} · {when(item.publishedAt)} {sample ? "· sample" : ""}
                  </p>
                  <p className="font-heading mt-1 text-xl leading-snug">{item.title}</p>
                  <p className="mt-2 rounded-lg bg-brand-pink/15 px-3 py-2 text-sm">
                    <span className="text-brand-pink">hook: </span>
                    {item.hookIdea}
                  </p>
                  <p className="mt-1 text-xs text-brand-cream/70">why: {item.reason}</p>
                </div>
                <div className="flex gap-1 sm:flex-col">
                  <Button size="sm" variant="secondary" asChild>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <ExternalLink /> {sample ? "source" : "read"}
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <section className="min-w-0 space-y-4" aria-labelledby="all">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="all" className="text-2xl text-primary">
              everything
            </h2>
            <Tabs value={tag} onValueChange={(v) => setTag(v as TrendTag | "all")}>
              <TabsList>
                <TabsTrigger value="all">all {items.length}</TabsTrigger>
                {(["hook potential", "explainer", "skip"] as const).map((t) => (
                  <TabsTrigger key={t} value={t}>
                    {t} {items.filter((i) => i.tag === t).length}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {visible.length === 0 ? <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">nothing matches these filters.</p> : null}

          <div className="grid gap-3">
            {visible.map((item) => (
              <Card key={item.id} className={cn("gap-3 py-4", item.tag === "skip" && "opacity-75")}>
                <CardHeader className="px-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("rounded-full px-2 py-0.5 font-medium", TAG_STYLE[item.tag])}>{item.tag}</span>
                    <span>{sourceName(item.sourceId)}</span>
                    <span aria-hidden>·</span>
                    <span>{when(item.publishedAt)}</span>
                    <span aria-hidden>·</span>
                    <span title="rule score, 0–100">score {item.score}</span>
                    {sample ? <Badge variant="outline">sample</Badge> : null}
                  </div>
                  <CardTitle className="mt-1 text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-4 sm:px-5">
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">why {item.tag}:</span> {item.reason}
                    {item.taggedBy === "claude" ? " (claude)" : " (rules)"}
                  </p>
                  {item.tag !== "skip" ? (
                    <div className="rounded-lg border-l-4 border-primary bg-secondary/50 p-3 text-sm">
                      <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">hook idea </span>
                      {item.hookIdea}
                    </div>
                  ) : null}
                  <div className="flex justify-end">
                    {item.tag !== "skip" ? <CopyHook text={item.hookIdea} /> : null}
                    <Button variant="ghost" size="sm" asChild>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <ExternalLink /> {sample ? "source" : "read"}
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

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
    </div>
  );
}
