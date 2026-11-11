import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCalendar, newId, upsertCalendarEntries } from "@/lib/store";
import { calendarEntryInputSchema } from "@/lib/schemas";
import type { CalendarEntry } from "@/lib/types";

export async function GET() {
  return Response.json(await getCalendar());
}

/**
 * The /script command posts here (or writes data/calendar.json directly when
 * the dev server isn't running). Accepts one entry or an array; entries with
 * an existing id are replaced, so re-running /script updates in place.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = z.union([calendarEntryInputSchema, z.array(calendarEntryInputSchema)]).safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const entries: CalendarEntry[] = (Array.isArray(parsed.data) ? parsed.data : [parsed.data]).map((e) => ({
    ...e,
    id: e.id ?? newId("cal"),
  }));
  await upsertCalendarEntries(entries);
  revalidatePath("/calendar");
  return Response.json({ entries }, { status: 201 });
}
