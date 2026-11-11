"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { PLATFORMS } from "@/lib/types";
import { saveHookAction, type SaveHookState } from "@/app/actions/hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AddHookDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SaveHookState, FormData>(saveHookAction, { ok: false, message: "" });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> add hook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>save a hook</DialogTitle>
          <DialogDescription>
            paste the first line of the video. leave the template empty and it’s written for you. for a video file, run{" "}
            <code className="text-xs">npm run hooks:transcribe</code> instead.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="transcript">hook (what they said)</Label>
            <Textarea id="transcript" name="transcript" required placeholder="nobody is talking about…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template">template (optional)</Label>
            <Textarea id="template" name="template" placeholder="auto: nobody is talking about [thing]…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="creator">creator</Label>
              <Input id="creator" name="creator" required placeholder="@handle" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="platform">platform</Label>
              <select id="platform" name="platform" defaultValue="instagram" className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs">
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">link</Label>
              <Input id="url" name="url" type="url" placeholder="https://" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="views">views</Label>
              <Input id="views" name="views" type="number" min={0} placeholder="120000" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tags">tags (comma separated)</Label>
            <Input id="tags" name="tags" placeholder="ai tools, list" />
          </div>
          {state.message && !state.ok ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "templating…" : "save hook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
