"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RefreshCw, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import { PLATFORMS, type ScheduledPost } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  approvePostAction,
  regenerateCaptionsAction,
  removePostAction,
  retryPostAction,
  unapprovePostAction,
  updatePostAction,
} from "@/app/actions/scheduler";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlatformBadges, formatWhen } from "@/components/platform-badges";

const STATUS: Record<ScheduledPost["status"], { label: string; className: string }> = {
  pending_approval: { label: "needs approval", className: "bg-secondary text-secondary-foreground" },
  approved: { label: "approved — waiting for /metricool send", className: "bg-primary text-primary-foreground" },
  in_metricool: { label: "in metricool", className: "bg-primary text-primary-foreground" },
  publishing: { label: "publishing…", className: "bg-primary text-primary-foreground" },
  published: { label: "published", className: "bg-muted text-muted-foreground" },
  failed: { label: "failed", className: "bg-destructive text-primary-foreground" },
};

export function PostCard({ post }: { post: ScheduledPost }) {
  const editable = post.status === "pending_approval" || post.status === "approved";
  const [captions, setCaptions] = useState(post.captions);
  const [media, setMedia] = useState(post.media.join("\n"));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const payload = () => ({ id: post.id, captions, media: media.split(/\s+/).map((s) => s.trim()).filter(Boolean) });
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg({ ok: res.ok, text: res.message });
    });

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-primary" suppressHydrationWarning>
            {formatWhen(post.scheduledFor)}
          </span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS[post.status].className)}>{STATUS[post.status].label}</span>
        </div>
        <CardTitle className="text-xl">{post.title}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <PlatformBadges platforms={post.platforms} format={post.format} />
          <span className="text-xs">captions:{" "}
            {post.captionSource === "claude" || post.captionSource === "script"
              ? "written by claude"
              : post.captionSource === "edited"
                ? "edited by you"
                : "template — worth a read before approving"}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {post.platforms.map((id) => {
          const meta = PLATFORMS.find((p) => p.id === id)!;
          const text = captions[id] ?? "";
          return (
            <div key={id} className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${post.id}-${id}`}>{meta.label} caption</Label>
                <span className={cn("text-xs tabular-nums", text.length > meta.captionLimit ? "font-medium text-destructive" : "text-muted-foreground")}>
                  {text.length}/{meta.captionLimit}
                </span>
              </div>
              {editable ? (
                <Textarea id={`${post.id}-${id}`} value={text} onChange={(e) => setCaptions((c) => ({ ...c, [id]: e.target.value }))} className="min-h-24" />
              ) : (
                <p className="whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm">{text}</p>
              )}
              {post.results?.[id] ? (
                <p className={cn("text-xs", post.results[id]!.ok ? "text-muted-foreground" : "text-destructive")}>
                  {post.results[id]!.ok ? (
                    post.results[id]!.url ? (
                      <a href={post.results[id]!.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                        ✓ scheduled in metricool — open
                      </a>
                    ) : (
                      `✓ posted (${post.results[id]!.id})`
                    )
                  ) : (
                    `✗ ${post.results[id]!.error}`
                  )}
                </p>
              ) : null}
            </div>
          );
        })}
        <div className="grid gap-1.5">
          <Label htmlFor={`${post.id}-media`}>{post.format === "reel" ? "video url" : "image urls (2–10, one per line, in order)"}</Label>
          {editable ? (
            <Textarea
              id={`${post.id}-media`}
              value={media}
              onChange={(e) => setMedia(e.target.value)}
              placeholder={post.format === "reel" ? "https://drive.google.com/file/d/…" : "https://drive.google.com/file/d/… (slide 1)\nhttps://drive.google.com/file/d/… (slide 2)"}
              className="min-h-12 font-mono text-xs"
            />
          ) : (
            <p className="break-all font-mono text-xs text-muted-foreground">{post.media.join(" · ") || "—"}</p>
          )}
          {editable ? (
            <p className="text-xs text-muted-foreground">paste a google drive or dropbox share link (metricool uploads it), or any public https link to the file.</p>
          ) : null}
        </div>
        {msg ? (
          <p role="status" className={cn("text-sm", msg.ok ? "text-muted-foreground" : "font-medium text-destructive")}>
            {msg.text}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex-wrap gap-2 border-t pt-4">
        {post.status === "pending_approval" ? (
          <>
            <Button disabled={pending} onClick={() => run(() => approvePostAction(payload()))}>
              <CheckCircle2 /> approve & schedule
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => run(() => updatePostAction(payload()))}>
              <Save /> save
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => run(() => regenerateCaptionsAction(post.id))}>
              <RefreshCw /> redo captions
            </Button>
          </>
        ) : null}
        {post.status === "in_metricool" ? (
          <p className="text-xs text-muted-foreground">sent to metricool — it publishes at the time. to change it now, edit it in metricool (link above).</p>
        ) : null}
        {post.status === "approved" ? (
          <>
            <Button variant="outline" disabled={pending} onClick={() => run(() => updatePostAction(payload()))}>
              <Save /> save edits
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => run(() => unapprovePostAction(post.id))}>
              <Undo2 /> withdraw approval
            </Button>
          </>
        ) : null}
        {post.status === "failed" ? (
          <Button disabled={pending} onClick={() => run(() => retryPostAction(post.id))}>
            <RotateCcw /> retry failed platforms
          </Button>
        ) : null}
        {editable || post.status === "failed" ? (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label="Remove post"
            disabled={pending}
            onClick={() => confirm("remove this post from the scheduler?") && run(() => removePostAction(post.id))}
          >
            <Trash2 />
          </Button>
        ) : null}
        {post.approvedAt && post.status !== "pending_approval" ? (
          <Badge variant="muted" className="ml-auto" suppressHydrationWarning>
            approved {formatWhen(post.approvedAt)}
          </Badge>
        ) : null}
      </CardFooter>
    </Card>
  );
}
