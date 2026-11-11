"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Search, Trash2 } from "lucide-react";
import type { Hook, HookFormat } from "@/lib/types";
import { PLATFORMS } from "@/lib/types";
import { cn, formatCompact, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteHookAction } from "@/app/actions/hooks";

const FORMATS: HookFormat[] = ["curiosity", "contrarian", "listicle", "story", "pov", "how-to", "result-first", "callout"];

/** Highlight [placeholders] so the reusable slots stand out. */
function TemplateText({ text }: { text: string }) {
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "copied" : "copy template"}
    </Button>
  );
}

export function HookVault({ hooks }: { hooks: Hook[] }) {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<HookFormat | "all">("all");
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    hooks.forEach((h) => c.set(h.format, (c.get(h.format) ?? 0) + 1));
    return c;
  }, [hooks]);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return hooks.filter(
      (h) =>
        (format === "all" || h.format === format) &&
        (!q || [h.transcript, h.template, h.creator, ...h.tags].some((s) => s.toLowerCase().includes(q))),
    );
  }, [hooks, query, format]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search hooks, creators, tags" className="pl-9" aria-label="Search hooks" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by format">
          {(["all", ...FORMATS] as const).map((f) => {
            const n = f === "all" ? hooks.length : counts.get(f) ?? 0;
            if (f !== "all" && n === 0) return null;
            return (
              <button
                key={f}
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  format === f ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                {f} <span className="opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">no hooks match. save one with “add hook”.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((h) => (
            <Card key={h.id} className="gap-4">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>{h.format}</Badge>
                  <Badge variant="muted">{PLATFORMS.find((p) => p.id === h.platform)?.label}</Badge>
                  {h.views ? <Badge variant="outline">{formatCompact(h.views)} views</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <blockquote className="font-heading text-xl leading-snug text-primary">“{h.transcript}”</blockquote>
                <div className="rounded-lg bg-muted/70 p-3 text-sm leading-relaxed">
                  <p className="mb-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">template</p>
                  <TemplateText text={h.template} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {h.creator} · saved {formatDate(h.savedAt)}
                  {h.tags.length ? ` · ${h.tags.join(", ")}` : ""}
                </p>
              </CardContent>
              <CardFooter className="justify-between gap-1">
                <CopyButton text={h.template} />
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
