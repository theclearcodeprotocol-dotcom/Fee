/**
 * Metricool constants and helpers, shared by the /metricool skill's scripts.
 * The dashboard can't call Metricool itself — Claude does, through the
 * Metricool connector — so these scripts only shape data in and out.
 */

export const METRICOOL = {
  brandId: "7976989",
  timezone: "Europe/London",
  /** analytics request #1 — keep this order, metricool-import reads by position */
  evolutionMetrics: ["IGEV05", "IGEV29", "IGEV15", "IGEV43"], // views, reels saved, feed posts saved, followers gained
  /** analytics request #2 — keep this order */
  reelMetrics: ["IGRE02", "IGRE03", "IGRE04", "IGRE06", "IGRE23", "IGRE12", "IGRE21", "IGRE07", "IGRE11", "IGRE27", "IGRE30"],
  // date+time, text, reel id, url, views, saved, shares, comments, reach, retention %, skip rate %
  /** TikTok daily — keep this order: video views, followers gained, likes, shares */
  tiktokEvolutionMetrics: ["TKEV12", "TKEV16", "TKEV13", "TKEV15"],
  /** TikTok videos — keep this order */
  tiktokVideoMetrics: ["TKPO02", "TKPO05", "TKPO03", "TKPO07", "TKPO08", "TKPO09", "TKPO10", "TKPO11", "TKPO13", "TKPO16"],
  // date+time, description, url, views, likes, comments, shares, reach, watched-to-end %, For You %
  /** competitor accounts — keep this order */
  competitorMetrics: ["IGCO02", "IGCO03", "IGCO07"], // handle, display name, followers
  /** competitor reels — keep this order */
  competitorReelMetrics: ["IGCR01", "IGCR02", "IGCR03", "IGCR04", "IGCR06", "IGCR07", "IGCR08"],
  // competitor handle, reel id, text, url, published (date+time), likes, comments
} as const;

/** Wall-clock parts of an instant in a timezone. */
export function zoned(iso: string, timeZone: string = METRICOOL.timezone) {
  const d = new Date(iso);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const offset = parts.timeZoneName === "GMT" ? "+00:00" : parts.timeZoneName.replace("GMT", "");
  const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  return { local, offset, isoWithOffset: `${local}${offset}` };
}

/** "20261103181925" (London wall time) → ISO instant. */
export function fromMetricoolStamp(stamp: string, timeZone: string = METRICOOL.timezone) {
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/);
  if (!m) return new Date(stamp).toISOString();
  const local = `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"}`;
  // find the offset that zone had at (roughly) that moment
  const guess = new Date(`${local}Z`).toISOString();
  return new Date(`${local}${zoned(guess, timeZone).offset}`).toISOString();
}

export const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
export const optNum = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number(v));
