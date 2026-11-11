/** Creating hooks — shared by the vault form, the API route and "save to hook vault". */
import { mutate, newId } from "./store.ts";
import { templateHook } from "./ai.ts";
import type { Hook, Platform } from "./types.ts";

export interface NewHook {
  transcript: string;
  template?: string;
  niche?: string;
  creator: string;
  platform: Platform;
  url?: string;
  views?: number;
  onScreenText?: string;
  sourceReelId?: string;
}

export async function createHook(input: NewHook): Promise<{ hook: Hook; templatedBy: "claude" | "template" | "provided" }> {
  const auto = input.template && input.niche ? null : await templateHook(input.transcript, input.niche);
  const hook: Hook = {
    id: newId("hook"),
    transcript: input.transcript.trim(),
    template: input.template?.trim() || auto!.template,
    format: auto?.format ?? "curiosity",
    niche: (input.niche || auto?.niche || "general").toLowerCase(),
    creator: input.creator.startsWith("@") ? input.creator : `@${input.creator}`,
    platform: input.platform,
    url: input.url,
    views: input.views,
    onScreenText: input.onScreenText || undefined,
    sourceReelId: input.sourceReelId,
    savedAt: new Date().toISOString(),
  };
  await mutate("hooks", (file) => {
    file.hooks.unshift(hook);
  });
  return { hook, templatedBy: auto?.source ?? "provided" };
}

/** The exact line to paste into Claude Code for a hook. */
export function scriptCommand(hook: Pick<Hook, "id" | "template">) {
  return `/script --hook "${hook.template.replace(/"/g, "'")}" --from ${hook.id}`;
}
