/** Read a /script file for the calendar side panel. Server-only. */
import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { CalendarEntry } from "./types.ts";

// The repo root is the dashboard's parent; /script writes to <repo>/content/scripts/.
const SCRIPTS_DIR = resolve(process.cwd(), "..", "content", "scripts");

export async function loadScript(entry: CalendarEntry): Promise<string | null> {
  if (entry.scriptPath) {
    const file = resolve(process.cwd(), "..", entry.scriptPath);
    if (file.startsWith(SCRIPTS_DIR + sep)) {
      try {
        // drop YAML front matter; the panel shows hook/angle/cta from the entry itself
        return (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
      } catch {
        /* file moved or not written yet */
      }
    }
  }
  return entry.script?.trim() || null;
}

export const SCRIPTS_DIR_FOR_DOCS = join("content", "scripts");
