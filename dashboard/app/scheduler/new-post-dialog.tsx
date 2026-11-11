"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { newEntryAction } from "@/app/actions/scheduler";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewPostDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(newEntryAction, { ok: false, message: "" });
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);
  const select = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> quick post
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>quick post</DialogTitle>
          <DialogDescription>for something you didn’t write with /script. it lands on the calendar, ready to schedule.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="np-title">title</Label>
            <Input id="np-title" name="title" required />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="np-date">date</Label>
              <Input id="np-date" name="date" type="date" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="np-time">time</Label>
              <Input id="np-time" name="time" type="time" defaultValue="18:00" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="np-format">format</Label>
              <select id="np-format" name="format" className={select} defaultValue="reel">
                <option value="reel">reel</option>
                <option value="carousel">carousel</option>
              </select>
            </div>
          </div>
          <fieldset className="flex gap-4 text-sm">
            <legend className="mb-2 font-medium">platforms</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="platforms" value="instagram" defaultChecked className="accent-[var(--brand-red)]" /> Instagram
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="platforms" value="tiktok" defaultChecked className="accent-[var(--brand-red)]" /> TikTok
            </label>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor="np-hook">hook</Label>
            <Textarea id="np-hook" name="hook" required className="min-h-12" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="np-angle">angle</Label>
            <Input id="np-angle" name="angle" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="np-cta">cta</Label>
            <Input id="np-cta" name="cta" placeholder="save this for later" />
          </div>
          {state.message && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              add to calendar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
