import { revalidatePath } from "next/cache";
import { getHooks } from "@/lib/store";
import { newHookSchema } from "@/lib/schemas";
import { createHook } from "@/lib/hooks";

export async function GET() {
  return Response.json(await getHooks());
}

/** Used by `npm run hooks:transcribe` (ElevenLabs) and any other ingest. */
export async function POST(request: Request) {
  const parsed = newHookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const result = await createHook(parsed.data);
  revalidatePath("/hooks");
  return Response.json(result, { status: 201 });
}
