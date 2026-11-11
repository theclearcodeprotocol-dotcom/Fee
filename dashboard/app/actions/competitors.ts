"use server";

import { revalidatePath } from "next/cache";
import { competitorReelInputSchema } from "@/lib/schemas";
import { addCompetitorReels, removeCompetitorReel } from "@/lib/competitors";

type Result = { ok: boolean; message: string };

export async function addCompetitorReelAction(_prev: Result, form: FormData): Promise<Result> {
  const parsed = competitorReelInputSchema.safeParse({
    creator: form.get("creator"),
    followers: form.get("followers") || undefined,
    hook: form.get("hook"),
    onScreenText: form.get("onScreenText") || undefined,
    views: form.get("views") || undefined,
    likes: form.get("likes") || undefined,
    url: form.get("url") ?? "",
    postedAt: form.get("postedAt") || undefined,
    source: "manual",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "check the form" };
  if (parsed.data.views === undefined && parsed.data.likes === undefined) return { ok: false, message: "add the views (or at least the likes)" };
  const { added } = await addCompetitorReels([parsed.data]);
  revalidatePath("/competitors");
  return { ok: true, message: added ? "added" : "updated" };
}

export async function removeCompetitorReelAction(id: string) {
  await removeCompetitorReel(id);
  revalidatePath("/competitors");
}
