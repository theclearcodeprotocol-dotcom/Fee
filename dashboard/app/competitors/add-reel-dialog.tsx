"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { addCompetitorReelAction } from "@/app/actions/competitors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AddReelDialog({ handles }: { handles: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addCompetitorReelAction, { ok: false, message: "" });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      setOpen(false);
    }
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> add reel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>add a competitor reel</DialogTitle>
          <DialogDescription>
            quicker for lots: screenshot their reels tab and send it to claude with /competitors — it fills this in for you.
          </DialogDescription>
        </DialogHeader>
        <form ref={form} action={action} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cr-creator">account</Label>
              <Input id="cr-creator" name="creator" list="cr-handles" required placeholder="@handle" />
              <datalist id="cr-handles">
                {handles.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cr-followers">their followers</Label>
              <Input id="cr-followers" name="followers" type="number" min={0} placeholder="12500" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cr-hook">hook (first line said, or the cover text)</Label>
            <Textarea id="cr-hook" name="hook" required className="min-h-12" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cr-ost">on-screen text (optional)</Label>
            <Input id="cr-ost" name="onScreenText" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="cr-views">views</Label>
              <Input id="cr-views" name="views" type="number" min={0} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cr-likes">likes</Label>
              <Input id="cr-likes" name="likes" type="number" min={0} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cr-date">posted</Label>
              <Input id="cr-date" name="postedAt" type="date" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cr-url">link (optional)</Label>
            <Input id="cr-url" name="url" type="url" placeholder="https://www.instagram.com/reel/…" />
          </div>
          {state.message && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              add reel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
