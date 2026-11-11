"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { PLATFORMS, type ScheduledPost } from "@/lib/types";
import { deletePostAction } from "@/app/actions/scheduler";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function Queue({ posts }: { posts: ScheduledPost[] }) {
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>queue</CardTitle>
        <CardDescription>{posts.length} post{posts.length === 1 ? "" : "s"} scheduled</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {posts.length === 0 ? <p className="text-sm text-muted-foreground">nothing scheduled yet.</p> : null}
        {posts.map((p) => (
          <div key={p.id} className="rounded-lg border bg-background/60 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary" suppressHydrationWarning>
                  {when(p.scheduledFor)}
                </p>
                <p className="font-heading mt-1 text-lg leading-snug text-primary">{p.title}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={`Remove ${p.title}`}
                onClick={() => confirm("remove from the queue?") && start(() => deletePostAction(p.id))}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {p.platforms.map((id) => (
                <Badge key={id} variant="secondary">
                  {PLATFORMS.find((x) => x.id === id)?.label}
                </Badge>
              ))}
            </div>
            {p.captions[p.platforms[0]] ? (
              <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{p.captions[p.platforms[0]]}</p>
            ) : null}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          publishing runs through a scheduling provider (metricool recommended) — see CLAUDE.md. the queue here is the source of truth.
        </p>
      </CardContent>
    </Card>
  );
}
