"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyMetric } from "@/lib/types";
import { formatCompact, formatDate } from "@/lib/utils";

const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13 },
  labelStyle: { color: "var(--brand-red)", fontWeight: 600 },
  labelFormatter: (d: unknown) => formatDate(String(d), { weekday: "short", day: "numeric", month: "short" }),
  formatter: (v: unknown) => formatCompact(Number(v)),
};

export function ViewsChart({ data }: { data: DailyMetric[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Area chart of daily views over the last 28 days">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" {...axis} tickFormatter={(d) => formatDate(d)} minTickGap={24} />
          <YAxis {...axis} tickFormatter={(v) => formatCompact(v)} width={48} />
          <Tooltip {...tooltipStyle} />
          <Area type="monotone" dataKey="views" stroke="var(--chart-1)" strokeWidth={2} fill="url(#viewsFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EngagementChart({ data }: { data: DailyMetric[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Bar chart of daily saves and follows over the last 14 days">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -12, right: 8, top: 8 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" {...axis} tickFormatter={(d) => formatDate(d, { day: "numeric" })} />
          <YAxis {...axis} tickFormatter={(v) => formatCompact(v)} width={48} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="saves" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="follows" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
