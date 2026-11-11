import { generateCaptions } from "@/lib/ai";
import { captionRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const parsed = captionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  return Response.json(await generateCaptions(parsed.data));
}
