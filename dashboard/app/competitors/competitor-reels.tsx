"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { CompetitorReel } from "@/lib/types";
import { formatCompact, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = CompetitorReel & { multiple: number; creatorName: string };

export function CompetitorReels({ rows, creators }: { rows: Row[]; creators: { handle: string; name: string }[] }) {
  const [creator, setCreator] = useState("all");
  const visible = creator === "all" ? rows : rows.filter((r) => r.creator === creator);
  return (
    <Card>
      <CardHeader>
        <CardTitle>top reels this week</CardTitle>
        <CardAction>
          <Select value={creator} onValueChange={setCreator}>
            <SelectTrigger className="w-44" aria-label="Filter by creator">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all creators</SelectItem>
              {creators.map((c) => (
                <SelectItem key={c.handle} value={c.handle}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>outlier</TableHead>
              <TableHead>hook</TableHead>
              <TableHead>creator</TableHead>
              <TableHead className="text-right">views</TableHead>
              <TableHead className="text-right">likes</TableHead>
              <TableHead className="text-right">comments</TableHead>
              <TableHead>posted</TableHead>
              <TableHead className="sr-only">link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Badge variant={r.multiple >= 2 ? "default" : r.multiple >= 1 ? "secondary" : "muted"}>{r.multiple.toFixed(1)}×</Badge>
                </TableCell>
                <TableCell className="min-w-64 font-medium">{r.hook}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{r.creatorName}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(r.views)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(r.likes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCompact(r.comments)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(r.postedAt)}</TableCell>
                <TableCell>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-primary" aria-label="Open reel">
                      <ExternalLink className="size-4" />
                    </a>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
