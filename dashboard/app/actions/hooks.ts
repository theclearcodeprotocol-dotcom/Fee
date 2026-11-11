"use server";

import { revalidatePath } from "next/cache";
import { getCompetitors, getHooks, mutate } from "@/lib/store";
import { newHookSchema } from "@/lib/schemas";
import { createHook, scriptCommand } from "@/lib/hooks";

export type SaveHookState = { ok: boolean; message: string };

export async function saveHookAction(_prev: SaveHookState, form: FormData): Promise<SaveHookState> {
  const parsed = newHookSchema.safeParse({
    transcript: form.get("transcript"),
    template: form.get("template") || undefined,
    niche: form.get("niche") || undefined,
    creator: form.get("creator"),
    platform: form.get("platform") || "instagram",
    url: form.get("url") ?? "",
    views: form.get("views") || undefined,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "check the form" };
  const { templatedBy } = await createHook(parsed.data);
  revalidatePath("/hooks");
  return { ok: true, message: templatedBy === "provided" ? "saved" : `saved — templated by ${templatedBy === "claude" ? "claude" : "the built-in rules"}` };
}

export async function deleteHookAction(id: string) {
  await mutate("hooks", (file) => {
    file.hooks = file.hooks.filter((h) => h.id !== id);
  });
  revalidatePath("/hooks");
}

/** "use this": queue the hook for /script and return the command to paste. */
export async function useHookAction(id: string): Promise<{ ok: boolean; command: string; message: string }> {
  const hook = (await getHooks()).hooks.find((h) => h.id === id);
  if (!hook) return { ok: false, command: "", message: "hook not found" };
  await mutate("script-queue", (file) => {
    file.queue = file.queue.filter((q) => q.hookId !== id);
    file.queue.push({ hookId: hook.id, template: hook.template, transcript: hook.transcript, niche: hook.niche, queuedAt: new Date().toISOString() });
  });
  revalidatePath("/hooks");
  return { ok: true, command: scriptCommand(hook), message: "queued for /script" };
}

export async function unqueueHookAction(id: string) {
  await mutate("script-queue", (file) => {
    file.queue = file.queue.filter((q) => q.hookId !== id);
  });
  revalidatePath("/hooks");
}

/** "save to hook vault" from the competitor tracker. */
export async function saveReelToVaultAction(reelId: string): Promise<{ ok: boolean; message: string }> {
  const [{ reels, creators }, { hooks }] = await Promise.all([getCompetitors(), getHooks()]);
  if (hooks.some((h) => h.sourceReelId === reelId)) return { ok: true, message: "already in the vault" };
  const reel = reels.find((r) => r.id === reelId);
  if (!reel) return { ok: false, message: "reel not found" };
  const creator = creators.find((c) => c.handle === reel.creator);
  const { templatedBy } = await createHook({
    transcript: reel.hook,
    niche: creator?.niche,
    creator: reel.creator,
    platform: "instagram",
    url: reel.url,
    views: reel.views,
    onScreenText: reel.onScreenText,
    sourceReelId: reel.id,
  });
  revalidatePath("/hooks");
  revalidatePath("/competitors");
  return { ok: true, message: `saved — templated by ${templatedBy === "claude" ? "claude" : "the built-in rules"}` };
}
