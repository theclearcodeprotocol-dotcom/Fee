import type { Platform, PostFormat } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function PlatformBadges({ platforms, format }: { platforms: Platform[]; format?: PostFormat }) {
  return (
    <span className="flex flex-wrap gap-1">
      {format ? <Badge>{format}</Badge> : null}
      {platforms.map((p) => (
        <Badge key={p} variant="secondary">
          {p === "instagram" ? "Instagram" : "TikTok"}
        </Badge>
      ))}
    </span>
  );
}

export const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).toLowerCase();
