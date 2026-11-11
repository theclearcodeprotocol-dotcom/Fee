"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatCompact, formatDate } from "@/lib/utils";

export function Sparkline({ data, label }: { data: { date: string; value: number }[]; label: string }) {
  return (
    <div className="h-16 w-full" role="img" aria-label={`Sparkline: ${label}`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, padding: "4px 8px" }}
            labelStyle={{ color: "var(--brand-red)", fontWeight: 600 }}
            labelFormatter={(_, p) => (p?.[0]?.payload?.date ? formatDate(p[0].payload.date, { weekday: "short", day: "numeric", month: "short" }) : "")}
            formatter={(v) => [formatCompact(Number(v)), ""]}
            separator=""
          />
          <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={1.75} fill="url(#spark)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
