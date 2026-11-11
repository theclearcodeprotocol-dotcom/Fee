import type { Metadata } from "next";
import { Bookmark, Eye, Flame, Percent, UserPlus } from "lucide-react";
import { getAnalytics } from "@/lib/store";
import { summarise, HEATER_MULTIPLE } from "@/lib/analytics";
import { formatCompact, formatDate, formatPercent, cn } from "@/lib/utils";
import { PageHeader, DataSourceNote } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ViewsChart, EngagementChart } from "./charts";

export const metadata: Metadata = { title: "analytics" };
export const dynamic = "force-dynamic";

function Kpi({ label, value, change, icon: Icon }: { label: string; value: string; change: number; icon: typeof Eye }) {
  const up = change >= 0;
  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardDescription className="text-sm">{label}</CardDescription>
        <Icon className="size-4 text-primary" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="font-heading text-4xl text-primary">{value}</p>
        <p className={cn("mt-1 text-xs", up ? "text-foreground" : "text-primary")}>
          <span className="font-medium">{up ? "▲" : "▼"} {formatPercent(Math.abs(change))}</span>{" "}
          <span className="text-muted-foreground">vs last week</span>
        </p>
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage() {
  const file = await getAnalytics();
  if (file.daily.length === 0) {
    return (
      <>
        <PageHeader title="analytics" description={`${file.handle} on instagram.`} />
        <DataSourceNote meta={file.meta} />
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          no analytics yet — connect instagram (see CLAUDE.md, “not wired yet”).
        </p>
      </>
    );
  }
  const s = summarise(file);
  return (
    <>
      <PageHeader
        title="analytics"
        description={`${file.handle} on instagram — the last 7 days to ${formatDate(s.asOf, { day: "numeric", month: "long" })}, against the 7 before.`}
      />
      <DataSourceNote meta={file.meta} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="views" value={formatCompact(s.kpis.views.value)} change={s.kpis.views.change} icon={Eye} />
        <Kpi label="saves" value={formatCompact(s.kpis.saves.value)} change={s.kpis.saves.change} icon={Bookmark} />
        <Kpi label="follows" value={formatCompact(s.kpis.follows.value)} change={s.kpis.follows.change} icon={UserPlus} />
        <Kpi label="save rate" value={formatPercent(s.kpis.saveRate.value, 2)} change={s.kpis.saveRate.change} icon={Percent} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>daily views</CardTitle>
            <CardDescription>last 28 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ViewsChart data={s.daily} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>saves & follows</CardTitle>
            <CardDescription>last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <EngagementChart data={s.daily.slice(-14)} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="size-5" aria-hidden /> heaters of the week
          </CardTitle>
          <CardDescription>
            reels from the last 7 days with {HEATER_MULTIPLE}×+ your median views ({formatCompact(s.medianViews)}), ranked by heat — reach weighted
            by saves and follows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {s.heaters.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">no heaters this week yet. the best performers are below.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {s.heaters.map((r, i) => (
                <div key={r.id} className="relative overflow-hidden rounded-xl bg-primary p-5 text-primary-foreground">
                  <span aria-hidden className="font-heading absolute -right-1 -top-3 text-7xl text-brand-pink/25">
                    {i + 1}
                  </span>
                  <Badge className="bg-brand-pink text-primary">{r.multiple.toFixed(1)}× median</Badge>
                  <p className="font-heading mt-3 text-xl leading-snug">{r.title}</p>
                  <p className="mt-1 text-sm text-brand-cream/80">“{r.hook}”</p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-brand-cream/70">views</dt>
                      <dd className="font-medium">{formatCompact(r.views)}</dd>
                    </div>
                    <div>
                      <dt className="text-brand-cream/70">saves</dt>
                      <dd className="font-medium">{formatCompact(r.saves)}</dd>
                    </div>
                    <div>
                      <dt className="text-brand-cream/70">follows</dt>
                      <dd className="font-medium">{formatCompact(r.follows)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>top reels, last 28 days</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>reel</TableHead>
                <TableHead>posted</TableHead>
                <TableHead className="text-right">views</TableHead>
                <TableHead className="text-right">saves</TableHead>
                <TableHead className="text-right">save rate</TableHead>
                <TableHead className="text-right">follows</TableHead>
                <TableHead className="text-right">vs median</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.topReels.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="min-w-56 font-medium">{r.title}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(r.postedAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompact(r.views)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompact(r.saves)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(r.saves / r.views)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompact(r.follows)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.multiple.toFixed(1)}×</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
