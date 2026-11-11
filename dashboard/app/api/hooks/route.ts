import { revalidatePath } from "next/cache";
import { addHook, getHooks, newId } from "@/lib/store";
import { newHookSchema } from "@/lib/schemas";
import { templateHook } from "@/lib/ai";
import type { Hook } from "@/lib/types";

export async function GET() {
  return Response.json(await getHooks());
}

/** Used by `npm run hooks:transcribe` (ElevenLabs) and any other ingest. */
export async function POST(request: Request) {
  const parsed = newHookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const input = parsed.data;
  const auto = input.template && input.format ? null : await templateHook(input.transcript);
  const hook: Hook = {
    id: newId("hook"),
    transcript: input.transcript,
    template: input.template ?? auto!.template,
    format: input.format ?? auto!.format,
    creator: input.creator.startsWith("@") ? input.creator : `@${input.creator}`,
    platform: input.platform,
    url: input.url,
    views: input.views,
    tags: input.tags,
    savedAt: new Date().toISOString(),
  };
  await addHook(hook);
  revalidatePath("/hooks");
  return Response.json({ hook, templatedBy: auto?.source ?? "provided" }, { status: 201 });
}
