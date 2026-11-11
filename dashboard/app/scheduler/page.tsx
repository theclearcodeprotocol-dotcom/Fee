import type { Metadata } from "next";
import { getCalendar, getScheduled } from "@/lib/store";
import { READY_STATUSES } from "@/lib/posts";
import { PageHeader } from "@/components/page-header";
import { ShieldCheck } from "lucide-react";
import { ReadyList, ScheduleAllButton } from "./ready-list";
import { PostCard } from "./post-card";
import { NewPostDialog } from "./new-post-dialog";

export const metadata: Metadata = { title: "scheduler" };
export const dynamic = "force-dynamic";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-2xl text-primary">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function SchedulerPage() {
  const [{ entries }, { posts }] = await Promise.all([getCalendar(), getScheduled()]);
  const today = new Date().toISOString().slice(0, 10);
  const scheduledIds = new Set(posts.map((p) => p.calendarEntryId));
  const ready = entries.filter((e) => READY_STATUSES.includes(e.status) && e.date >= today && !scheduledIds.has(e.id));
  const byTime = (a: { scheduledFor: string }, b: { scheduledFor: string }) => a.scheduledFor.localeCompare(b.scheduledFor);
  const pending = posts.filter((p) => p.status === "pending_approval").sort(byTime);
  const approved = posts.filter((p) => p.status === "approved" || p.status === "publishing").sort(byTime);
  const done = posts.filter((p) => p.status === "published" || p.status === "failed").sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));

  return (
    <>
      <PageHeader
        title="scheduler"
        description="one click and claude drafts your reels and carousels for instagram and tiktok, captions written from hook + angle + cta. nothing posts until you approve it."
        actions={
          <>
            <NewPostDialog />
            <ScheduleAllButton count={ready.length} />
          </>
        }
      />
      <p className="mb-6 flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          <strong className="font-medium">you authorise every post.</strong> drafts wait in “needs your approval”. an approved post goes out at its time;
          editing it afterwards withdraws the approval automatically.
        </span>
      </p>

      <div className="space-y-10">
        <Section title={`ready to schedule · ${ready.length}`} description="scripted, filmed or edited pieces from the content calendar.">
          <ReadyList entries={ready} />
        </Section>
        <Section title={`needs your approval · ${pending.length}`} description="check the captions, add the media urls, then approve.">
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">nothing waiting for you.</p> : null}
          <div className="grid gap-4 xl:grid-cols-2">
            {pending.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </Section>
        <Section title={`approved · ${approved.length}`} description="these publish automatically at their time.">
          {approved.length === 0 ? <p className="text-sm text-muted-foreground">nothing approved yet.</p> : null}
          <div className="grid gap-4 xl:grid-cols-2">
            {approved.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </Section>
        {done.length ? (
          <Section title="published">
            <div className="grid gap-4 xl:grid-cols-2">
              {done.slice(0, 10).map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
}
