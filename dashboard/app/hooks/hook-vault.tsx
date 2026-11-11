"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Check, ExternalLink, Search, Trash2, X } from "lucide-react";
import type { Hook } from "@/lib/types";
import { cn, formatCompact, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteHookAction, unqueueHookAction, useHookAction } from "@/app/actions/hooks";

const VIEW_FLOORS = [
  { value: "0", label: "any views" },
  { value: "100000", label: "100k+ views" },
  { value: "500000", label: "500k+ views" },
  { value: "1000000", label: "1m+ views" },
];

/** Highlight [placeholders] so the reusable slots stand out. */
export function TemplateText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).map((part, i) =>
        part.startsWith("[") ? (
          <mark key={i} className="rounded bg-secondary px-1 font-medium text-secondary-foreground">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function UseThisButton({ hook, queued }: { hook: Hook; queued: boolean }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  if (queued) {
    return (
      <div className="flex items-center gap-1">
        <Badge className="gap-1">
          <Check /> queued for /script
        </Badge>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Remove from /script queue" onClick={() => start(() => unqueueHookAction(hook.id))}>
          <X />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await useHookAction(hook.id);
            if (!res.ok) return setNote(res.message);
            try {
              await navigator.clipboard.writeText(res.command);
              setNote("command copied — paste it into claude code");
            } catch {
              setNote(res.command);
            }
          })
        }
      >
        use this <ArrowRight />
      </Button>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}

export function HookVault({ hooks, queued }: { hooks: Hook[]; queued: string[] }) {
  const [query, setQuery] = useState("");
  const [niche, setNiche] = useState("all");
  const [minViews, setMinViews] = useState("0");
  const [sort, setSort] = useState<"views" | "recent">("views");
  const [shape, setShape] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const niches = useMemo(() => {
    const c = new Map<string, number>();
    hooks.forEach((h) => c.set(h.niche, (c.get(h.niche) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [hooks]);

  // templates that show up more than once are the proven shapes
  const shapes = useMemo(() => {
    const c = new Map<string, number>();
    hooks.forEach((h) => c.set(h.template.toLowerCase(), (c.get(h.template.toLowerCase()) ?? 0) + 1));
    return [...c.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  }, [hooks]);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    const floor = Number(minViews);
    return hooks
      .filter(
        (h) =>
          (niche === "all" || h.niche === niche) &&
          (h.views ?? 0) >= floor &&
          (!shape || h.template.toLowerCase() === shape) &&
          (!q || [h.transcript, h.template, h.creator, h.niche].some((s) => s.toLowerCase().includes(q))),
      )
      .sort((a, b) => (sort === "views" ? (b.views ?? 0) - (a.views ?? 0) : b.savedAt.localeCompare(a.savedAt)));
  }, [hooks, query, niche, minViews, sort, shape]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_10rem_10rem]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search hooks, templates, creators" className="pl-9" aria-label="Search hooks" />
        </div>
        <Select value={niche} onValueChange={setNiche}>
          <SelectTrigger aria-label="Niche">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all niches ({hooks.length})</SelectItem>
            {niches.map(([n, count]) => (
              <SelectItem key={n} value={n}>
                {n} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={minViews} onValueChange={setMinViews}>
          <SelectTrigger aria-label="Minimum views">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEW_FLOORS.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as "views" | "recent")}>
          <SelectTrigger aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="views">most viewed</SelectItem>
            <SelectItem value="recent">newest saved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {shapes.length ? (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Proven templates">
          <span className="mr-1 text-xs uppercase tracking-wider text-muted-foreground">proven shapes</span>
          {shapes.map(([s, n]) => (
            <button
              key={s}
              onClick={() => setShape(shape === s ? null : s)}
              aria-pressed={shape === s}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                shape === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              “{s}” <span className="opacity-70">×{n}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {visible.length} of {hooks.length} hooks
      </p>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">no hooks match. loosen a filter or add one.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((h) => (
            <Card key={h.id} className="gap-4">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{h.creator}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.niche} · {h.platform === "tiktok" ? "TikTok" : "Instagram"} · saved {formatDate(h.savedAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-heading text-2xl leading-none text-primary">{h.views ? formatCompact(h.views) : "—"}</p>
                    <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">views</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="rounded-lg bg-muted/70 p-3">
                  <p className="mb-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">template · {h.format}</p>
                  <p className="font-heading text-xl leading-snug text-primary">
                    <TemplateText text={h.template} />
                  </p>
                </div>
                <div>
                  <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">transcript</p>
                  <p className="text-sm">“{h.transcript}”</p>
                </div>
                {h.onScreenText ? (
                  <p className="text-xs text-muted-foreground">
                    on screen: <span className="text-foreground">{h.onScreenText}</span>
                  </p>
                ) : null}
              </CardContent>
              <CardFooter className="items-start justify-between gap-1">
                <UseThisButton hook={h} queued={queued.includes(h.id)} />
                <div className="flex">
                  {h.url ? (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={h.url} target="_blank" rel="noreferrer" aria-label="Open original">
                        <ExternalLink />
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label="Delete hook"
                    onClick={() => {
                      if (confirm("delete this hook?")) startTransition(() => deleteHookAction(h.id));
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
