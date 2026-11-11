"use server";

import { revalidatePath } from "next/cache";
import { addScheduledPost, deleteScheduledPost, newId } from "@/lib/store";
import { schedulePostSchema } from "@/lib/schemas";

export async function schedulePostAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = schedulePostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "check the form" };
  const missing = parsed.data.platforms.filter((p) => !parsed.data.captions[p]?.trim());
  if (missing.length) return { ok: false, message: `write or generate a caption for ${missing.join(", ")}` };

  await addScheduledPost({
    id: newId("post"),
    ...parsed.data,
    scheduledFor: new Date(parsed.data.scheduledFor).toISOString(),
    status: "scheduled",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/scheduler");
  return { ok: true, message: `scheduled on ${parsed.data.platforms.length} platform${parsed.data.platforms.length > 1 ? "s" : ""}` };
}

export async function deletePostAction(id: string) {
  await deleteScheduledPost(id);
  revalidatePath("/scheduler");
}
