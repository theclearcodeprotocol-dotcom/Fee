import { CalendarDays, ChartNoAxesColumn, Flame, Send, Swords, Vault } from "lucide-react";

export const NAV = [
  { href: "/hooks", label: "hook vault", icon: Vault },
  { href: "/analytics", label: "analytics", icon: ChartNoAxesColumn },
  { href: "/competitors", label: "competitor tracker", icon: Swords },
  { href: "/scheduler", label: "scheduler", icon: Send },
  { href: "/calendar", label: "content calendar", icon: CalendarDays },
  { href: "/trending", label: "what's trending", icon: Flame },
] as const;
