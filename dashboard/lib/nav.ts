import { CalendarDays, ChartNoAxesColumn, Flame, Send, Swords, Vault } from "lucide-react";

export const NAV = [
  { href: "/hooks", label: "hook vault", description: "every viral hook you save, transcribed and templated", icon: Vault },
  { href: "/analytics", label: "analytics", description: "ig views, saves, follows and this week's heaters", icon: ChartNoAxesColumn },
  { href: "/competitors", label: "competitive tracker", description: "top reels from creators you track, scraped weekly", icon: Swords },
  { href: "/scheduler", label: "scheduler", description: "one-click multi-platform scheduling with ai captions", icon: Send },
  { href: "/calendar", label: "content calendar", description: "auto-filled by /script with hooks and angles", icon: CalendarDays },
  { href: "/trending", label: "what's trending", description: "ai news from 12 sources, tagged for hook potential", icon: Flame },
] as const;
