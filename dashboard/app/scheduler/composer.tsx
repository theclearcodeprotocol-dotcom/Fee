"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import { PLATFORMS, type Platform } from "@/lib/types";
import { cn } from "@/lib/utils";
import { schedulePostAction } from "@/app/actions/scheduler";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Status = { tone: "ok" | "error" | "info"; text: string } | null;

export function Composer() {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [when, setWhen] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram", "tiktok", "youtube"]);
  const [captions, setCaptions] = useState<Partial<Record<Platform, string>>>({});
  const [status, setStatus] = useState<Status>(null);
  const [generating, setGenerating] = useState(false);
  const [scheduling, startScheduling] = useTransition();

  const toggle = (p: Platform, on: boolean) => setPlatforms((cur) => (on ? [...cur, p] : cur.filter((x) => x !== p)));
  const ordered = PLATFORMS.filter((p) => platforms.includes(p.id));

  async function generate() {
    if (!title.trim()) return setStatus({ tone: "error", text: "add a title first" });
    setGenerating(true);
    setStatus(null);
    try {
      const res = await fetch("/api/captions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, brief, platforms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("couldn't generate captions");
      setCaptions((cur) => ({ ...cur, ...data.captions }));
      setStatus(
        data.source === "claude"
          ? { tone: "ok", text: "captions written by claude — edit anything before scheduling" }
          : { tone: "info", text: `used built-in templates (${data.error ?? "claude unavailable"})` },
      );
    } catch (e) {
      setStatus({ tone: "error", text: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  function schedule() {
    if (!when) return setStatus({ tone: "error", text: "pick a date and time" });
    startScheduling(async () => {
      const res = await schedulePostAction({
        title,
        brief,
        // datetime-local is the viewer's local time; send it as a real instant
        scheduledFor: new Date(when).toISOString(),
        platforms,
        captions: Object.fromEntries(platforms.map((p) => [p, captions[p] ?? ""])),
      });
      setStatus({ tone: res.ok ? "ok" : "error", text: res.message });
      if (res.ok) {
        setTitle("");
        setBrief("");
        setCaptions({});
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>new post</CardTitle>
        <CardDescription>one video, every platform.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="title">title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="what an ai agent actually is" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="brief">brief</Label>
          <Textarea
            id="brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="what the video says, who it's for, the one thing to remember"
            className="min-h-20"
          />
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">platforms</legend>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <label
                key={p.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  platforms.includes(p.id) ? "border-primary bg-secondary" : "bg-card",
                )}
              >
                <Checkbox checked={platforms.includes(p.id)} onCheckedChange={(v) => toggle(p.id, v === true)} />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={generate} disabled={generating || platforms.length === 0}>
            <Sparkles /> {generating ? "writing captions…" : "generate captions"}
          </Button>
          {status ? (
            <p
              role="status"
              className={cn("text-sm", status.tone === "error" ? "text-destructive font-medium" : "text-muted-foreground")}
            >
              {status.text}
            </p>
          ) : null}
        </div>

        {ordered.length > 0 ? (
          <div className="grid gap-4">
            {ordered.map((p) => {
              const text = captions[p.id] ?? "";
              const over = text.length > p.captionLimit;
              return (
                <div key={p.id} className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`cap-${p.id}`}>{p.label}</Label>
                    <span className={cn("text-xs tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {text.length}/{p.captionLimit}
                    </span>
                  </div>
                  <Textarea
                    id={`cap-${p.id}`}
                    value={text}
                    onChange={(e) => setCaptions((c) => ({ ...c, [p.id]: e.target.value }))}
                    placeholder="generate, or write your own"
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-t pt-5 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="when">post at</Label>
          <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <Button size="lg" onClick={schedule} disabled={scheduling || platforms.length === 0}>
          <CalendarClock /> {scheduling ? "scheduling…" : `schedule on ${platforms.length} platform${platforms.length === 1 ? "" : "s"}`}
        </Button>
      </CardFooter>
    </Card>
  );
}
