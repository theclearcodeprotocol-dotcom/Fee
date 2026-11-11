"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, Plus, Trash2 } from "lucide-react";
import type { CompetitorReel, TrackedCreator } from "@/lib/types";
import { cn, formatCompact, formatDate } from "@/lib/utils";
import { saveReelToVaultAction } from "@/app/actions/hooks";
import { removeCompetitorReelAction } from "@/app/actions/competitors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Row = CompetitorReel & { followers: number; creatorName: string; saved: boolean };

function SaveButton({ row }: { row: Row }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (row.saved) {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Check /> in hook vault
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button size="sm" disabled={pending} onClick={() => start(async () => setMsg((await saveReelToVaultAction(row.id)).message))}>
        <Plus /> {pending ? "saving…" : "save to hook vault"}
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  );
}

function RemoveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Remove reel"
      disabled={pending}
      onClick={() => confirm("remove this reel from the tracker?") && start(() => removeCompetitorReelAction(id))}
    >
      <Trash2 />
    </Button>
  );
}

export function CompetitorReels({ rows, creators }: { rows: Row[]; creators: TrackedCreator[] }) {
  const [creator, setCreator] = useState<string | null>(null);
  const visible = creator ? rows.filter((r) => r.creator === creator) : rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by creator">
        <button
          onClick={() => setCreator(null)}
          aria-pressed={!creator}
          className={cn("rounded-full border px-3 py-1 text-sm", !creator ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
        >
          all {rows.length}
        </button>
        {creators.map((c) => (
          <button
            key={c.handle}
            onClick={() => setCreator(creator === c.handle ? null : c.handle)}
            aria-pressed={creator === c.handle}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              creator === c.handle ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
            )}
          >
            {c.handle} <span className="opacity-70">{formatCompact(c.followers)}</span>
          </button>
        ))}
      </div>

      <Card className="gap-0 py-0">
        <ol>
          {visible.map((r, i) => (
            <li key={r.id} className="grid gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[2.5rem_1fr_auto] sm:items-start sm:p-5">
              <span className="font-heading text-2xl leading-none text-primary/40" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-heading text-2xl leading-none text-primary">{formatCompact(r.views ?? r.likes)}</span>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{r.views !== undefined ? "views" : "likes"}</span>
                  <span className="font-medium">{r.creator}</span>
                  <span className="text-sm text-muted-foreground">{formatCompact(r.followers)} followers · {r.dateKnown === false ? "added" : "posted"} {formatDate(r.postedAt)}</span>
                </div>
                <div>
                  <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{r.source === "metricool" ? "hook (caption’s first line)" : "hook"}</p>
                  <p className="font-heading text-lg leading-snug text-primary">“{r.hook}”</p>
                </div>
                {r.transcript !== undefined ? (
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-muted/70 p-2.5">
                    <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">on-screen text</p>
                    <p>{r.onScreenText || <span className="text-muted-foreground">none</span>}</p>
                  </div>
                  <div className="rounded-lg bg-muted/70 p-2.5">
                    <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">transcript (opening)</p>
                    <p className="line-clamp-3">{r.transcript}</p>
                  </div>
                </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {[
                      r.onScreenText ? `on screen: ${r.onScreenText}` : "",
                      r.views !== undefined && r.likes ? `${formatCompact(r.likes)} likes` : "",
                      r.comments ? `${formatCompact(r.comments)} comments` : "",
                      r.source === "screenshot" ? "from a screenshot" : r.source === "manual" ? "added by hand" : "",
                      r.caption ? (r.caption.length > 140 ? `${r.caption.slice(0, 140)}…` : r.caption) : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 sm:flex-col sm:items-end">
                <SaveButton row={r} />
                {r.url ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      <ExternalLink /> open reel
                    </a>
                  </Button>
                ) : null}
                <RemoveButton id={r.id} />
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
