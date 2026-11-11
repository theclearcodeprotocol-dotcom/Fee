import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCalendar, mutate, newId } from "@/lib/store";
import { calendarEntryInputSchema } from "@/lib/schemas";
import type { CalendarEntry } from "@/lib/types";

export async function GET() {
  return Response.json(await getCalendar());
}

/**
 * The /script skill posts here (or edits data/calendar.json directly when the
 * dev server isn't running). One entry or an array; an existing id is replaced.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = z.union([calendarEntryInputSchema, z.array(calendarEntryInputSchema)]).safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const entries: CalendarEntry[] = (Array.isArray(parsed.data) ? parsed.data : [parsed.data]).map((e) => ({ ...e, id: e.id ?? newId("cal") }));
  await mutate("calendar", (file) => {
    for (const entry of entries) {
      const i = file.entries.findIndex((e) => e.id === entry.id);
      if (i >= 0) file.entries[i] = entry;
      else file.entries.push(entry);
    }
    file.entries.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  });
  revalidatePath("/calendar");
  revalidatePath("/scheduler");
  return Response.json({ entries }, { status: 201 });
}
