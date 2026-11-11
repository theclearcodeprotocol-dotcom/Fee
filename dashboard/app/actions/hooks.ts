"use server";

import { revalidatePath } from "next/cache";
import { addHook, deleteHook, newId } from "@/lib/store";
import { newHookSchema } from "@/lib/schemas";
import { templateHook } from "@/lib/ai";
import type { Hook } from "@/lib/types";

export type SaveHookState = { ok: boolean; message: string };

export async function saveHookAction(_prev: SaveHookState, form: FormData): Promise<SaveHookState> {
  const parsed = newHookSchema.safeParse({
    transcript: form.get("transcript"),
    template: form.get("template") || undefined,
    creator: form.get("creator"),
    platform: form.get("platform"),
    url: form.get("url") ?? "",
    views: form.get("views") || undefined,
    tags: String(form.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "check the form" };

  const input = parsed.data;
  const auto = input.template ? null : await templateHook(input.transcript);
  const hook: Hook = {
    id: newId("hook"),
    transcript: input.transcript,
    template: input.template ?? auto!.template,
    format: input.format ?? auto?.format ?? "curiosity",
    creator: input.creator.startsWith("@") ? input.creator : `@${input.creator}`,
    platform: input.platform,
    url: input.url,
    views: input.views,
    tags: input.tags,
    savedAt: new Date().toISOString(),
  };
  await addHook(hook);
  revalidatePath("/hooks");
  return { ok: true, message: auto ? `saved — templated by ${auto.source === "claude" ? "claude" : "the built-in rules"}` : "saved" };
}

export async function deleteHookAction(id: string) {
  await deleteHook(id);
  revalidatePath("/hooks");
}
