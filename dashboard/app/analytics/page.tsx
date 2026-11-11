import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Eye, Flame, MessageCircle, UserPlus } from "lucide-react";
import { getAnalytics } from "@/lib/store";
import { HEATER_MULTIPLE, RANGES, isHeater, metricSummary, popNote, reelsInRange, topHeaters, type MetricKey, type Range } from "@/lib/analytics";
import { cn, formatCompact, formatDate, formatPercent } from "@/lib/utils";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkline } from "./sparkline";

export const metadata: Metadata = { title: "analytics" };
export const dynamic = "force-dynamic";

const METRICS: { key: MetricKey; label: string; icon: typeof Eye }[] = [
  { key: "views", label: "views", icon: Eye },
  { key: "saves", label: "saves", icon: Bookmark },
  { key: "follows", label: "follows", icon: UserPlus },
  { key: "dms", label: "dms", icon: MessageCircle },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range = (RANGES.find((r) => String(r) === rangeParam) ?? 30) as Range;
  const file = await getAnalytics();

  const rangeTabs = (
    <nav aria-label="Date range" className="inline-flex rounded-full bg-muted p-1">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`/analytics?range=${r}`}
          aria-current={r === range ? "page" : undefined}
          className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {r} days
        </Link>
      ))}
    </nav>
  );

  if (file.daily.length === 0) {
    return (
      <>
        <PageHeader title="analytics" description={`${file.handle} on instagram.`} />
        <DataSourceNote meta={file.meta} />
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">no analytics yet — run npm run analytics:fetch (see CLAUDE.md).</p>
      </>
    );
  }

  const sortedDays = [...file.daily].sort((a, b) => a.date.localeCompare(b.date));
  const asOf = sortedDays.at(-1)!.date;
  const since = sortedDays[0].date;
  const short = sortedDays.length < range;
  const reels = reelsInRange(file, range).sort((a, b) => b.reel.views - a.reel.views);
  const heaters = topHeaters(file, range);

  return (
    <>
      <PageHeader
        title="analytics"
        description={`${file.handle} on instagram — the last ${range} days to ${formatDate(asOf, { day: "numeric", month: "long" })}.${short ? ` history starts ${formatDate(since, { day: "numeric", month: "long" })}, so this shows ${sortedDays.length} days for now.` : ""}`}
        actions={rangeTabs}
      />
      <DataSourceNote meta={file.meta} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map(({ key, label, icon: Icon }) => {
          const s = metricSummary(file.daily, key, range);
          if (!s.available) {
            return (
              <Card key={key} className="gap-3">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardDescription className="text-sm">{label}</CardDescription>
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-4xl leading-none text-muted-foreground">—</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    metricool doesn’t provide dm numbers. check them in the instagram app, or connect the instagram api directly (see CLAUDE.md).
                  </p>
                </CardContent>
              </Card>
            );
          }
          return (
            <Card key={key} className="gap-3 pb-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardDescription className="text-sm">{label}</CardDescription>
                <Icon className="size-4 text-primary" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="font-heading text-4xl leading-none text-primary">{formatCompact(s.total)}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {s.change === null ? (
                    "no earlier period to compare"
                  ) : (
                    <>
                      <span className="font-medium text-foreground">
                        {s.change >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(s.change))}
                      </span>{" "}
                      vs the {range} days before
                    </>
                  )}
                </p>
              </CardContent>
              <Sparkline data={s.series} label={`${label}, daily, last ${range} days`} />
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="size-5" aria-hidden /> top heaters
          </CardTitle>
          <CardDescription>
            reels from the last {range} days that beat your 30-day median views by {HEATER_MULTIPLE}× or more — top 5 by views.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {heaters.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              {file.reels.length < 4
                ? `heaters need a few reels to compare against — ${file.reels.length} reel${file.reels.length === 1 ? "" : "s"} so far. they’ll appear as you post.`
                : `no heaters in the last ${range} days. try a longer range.`}
            </p>
          ) : (
            <ol className="grid gap-3">
              {heaters.map((h, i) => (
                <li key={h.reel.id} className="grid gap-3 rounded-xl bg-primary p-4 text-primary-foreground sm:grid-cols-[3rem_1fr_auto] sm:items-center sm:p-5">
                  <span aria-hidden className="font-heading text-4xl leading-none text-brand-pink">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-heading text-xl leading-snug">{h.reel.title}</p>
                    <p className="mt-1 text-sm text-brand-cream/85">{popNote(h.reel, file.reels)}</p>
                    <p className="mt-1 text-xs text-brand-cream/65">
                      posted {formatDate(h.reel.postedAt)} · “{h.reel.hook}”
                    </p>
                  </div>
                  <div className="flex gap-4 sm:block sm:text-right">
                    <p className="font-heading text-3xl leading-none">{formatCompact(h.reel.views)}</p>
                    <Badge className="mt-1 bg-brand-pink text-primary">{h.multiple!.toFixed(1)}× median</Badge>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>every reel, last {range} days</CardTitle>
          <CardDescription>{reels.filter(isHeater).length} flagged as heaters</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>reel</TableHead>
                <TableHead>posted</TableHead>
                <TableHead className="text-right">views</TableHead>
                <TableHead className="text-right">vs 30-day median</TableHead>
                <TableHead className="text-right">saves</TableHead>
                <TableHead className="text-right">shares</TableHead>
                <TableHead className="text-right">comments</TableHead>
                <TableHead className="text-right" title="swiped away in the first 3 seconds">skip rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reels.map((h) => (
                <TableRow key={h.reel.id}>
                  <TableCell className="min-w-56 font-medium">
                    {h.reel.title}
                    {isHeater(h) ? (
                      <Badge className="ml-2 gap-1">
                        <Flame /> heater
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(h.reel.postedAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompact(h.reel.views)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", isHeater(h) && "font-semibold text-primary")}>
                    {h.multiple === null ? <span title="no earlier reels to compare with">—</span> : `${h.multiple.toFixed(1)}×`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompact(h.reel.saves)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompact(h.reel.shares)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompact(h.reel.comments)}</TableCell>
                  <TableCell className="text-right tabular-nums">{h.reel.skipRate !== undefined ? `${h.reel.skipRate.toFixed(0)}%` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
