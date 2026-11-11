# the clear code. — content dashboard

The content dashboard for @theclearcode. It has six pages, all served from this folder.
The repo root is a separate HyperFrames video project: its own CLAUDE.md covers that, and
none of its rules (the GSAP timelines, `npm run check`) apply here.

| Page | Route | Data file | Filled by |
|---|---|---|---|
| hook vault | `/hooks` | `data/hooks.json` | the "add hook" dialog, `POST /api/hooks`, `npm run hooks:transcribe` (ElevenLabs) |
| analytics | `/analytics` | `data/analytics.json` | sample data for now. Connect Instagram, see "Not wired yet" |
| competitive tracker | `/competitors` | `data/competitors.json` | `npm run scrape:competitors` (Apify), weekly |
| scheduler | `/scheduler` | `data/scheduled.json` | the composer, with captions from `POST /api/captions` (Claude) |
| content calendar | `/calendar` | `data/calendar.json` | the `/script` skill (`../.claude/skills/script/SKILL.md`), or `POST /api/calendar` |
| what's trending | `/trending` | `data/trending.json` | `npm run trending:fetch` (12 RSS feeds) |

`/` redirects to `/hooks`.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack) and **TypeScript 5**. TypeScript 7 was
  skipped on purpose because Next's type-check step still uses the TS 5 compiler API.
- **Tailwind CSS v4**, set up CSS-first in `app/globals.css` with `@theme inline`. There is
  no `tailwind.config`.
- **shadcn/ui** (new-york style, unified `radix-ui` package, lucide icons). The components
  are in `components/ui/` and `components.json` is set up, so `npx shadcn@latest add <name>`
  works. The first components were written by hand from shadcn's source because the build
  sandbox couldn't reach the registry. Keep using `data-slot` and `cn()` the same way when
  you add more.
- **Recharts** for the analytics charts (`app/analytics/charts.tsx`).
- **zod v4** checks every form and API input (`lib/schemas.ts`).
- **@anthropic-ai/sdk** for captions and hook templates (`lib/ai.ts`).
- **Node ≥ 22.18**. Scripts in `scripts/*.ts` run with plain `node`, which strips the
  types itself. There is no tsx or ts-node. Any file a script imports (`lib/types.ts`,
  `lib/hook-potential.ts`, `lib/trend-sources.ts`) must stay free of dependencies and
  import other files with an explicit `.ts` extension. `allowImportingTsExtensions` is on
  for this reason.

```bash
npm install
npm run dev                 # http://localhost:3000
npm run build && npm start  # production
npm run typecheck
npm run seed                # rewrite data/*.json with deterministic SAMPLE data
npm run data:clear-sample   # empty the sample data once real sources are connected
npm run trending:fetch      # pull the 12 feeds → data/trending.json
npm run scrape:competitors  # APIFY_TOKEN=… → data/competitors.json
npm run hooks:transcribe -- clip.mp4 --creator @handle   # ElevenLabs → hook vault (dev server must be running)
```

Environment variables (put them in `.env.local`, which git ignores):

| Var | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | captions, hook templates | optional. Without it the app uses built-in templates and says so in the UI |
| `ELEVENLABS_API_KEY` | `hooks:transcribe` | the network proxy adds it in Fee cloud sessions |
| `APIFY_TOKEN` | `scrape:competitors` | |

## Brand (from `../brand/BRAND.md`)

- Palette: red `#AE1F14`, cream `#F2F0E0`, pink `#FFD7DE`, and white as an accent only.
  They're defined as tokens in `app/globals.css` (`--brand-*`) and mapped onto the shadcn
  variables (`--primary` = red, `--background` = cream, `--secondary`/`--accent` = pink).
- Everything else is derived from those three, never a new colour:
  - `--brand-ink #2A1210` is red at very low lightness and is used for body text. Long text
    set in full red is tiring to read, so red is kept for headings and accents.
  - `--brand-red-deep` is the hover colour.
  - The `--muted` cream and the chart tints `--chart-2..5` are red and pink tints.
- Headings use Source Serif 4 Black (900), tracked at -0.05em. They're applied to
  `h1–h3` and `.font-heading`. The font is loaded with `next/font/local` from
  `app/fonts/` (copied from `../assets/fonts`, OFL).
- Body text uses Outfit, the closest free match to Dacht. It's self-hosted through
  `@fontsource-variable/outfit`, so the build needs no network for fonts.
- The sidebar is solid brand red with cream text and a pink pill for the active page.
  **@theclearcode** sits at the top in the serif, and the `c.` lettermark sits at the bottom
  as the watermark.
- UI copy is lower-case, matching the logo. Proper nouns (platform names, Claude) keep
  their capitals.
- There's no dark mode. The brand is a light cream ground, so dark mode was left out of v1
  on purpose.

## Decisions

1. **Self-contained app in `dashboard/`.** The repo root is the HyperFrames project with
   its own `package.json`. `next.config.ts` pins `turbopack.root` and
   `outputFileTracingRoot` to this folder so Next doesn't pick up the parent.
2. **JSON files instead of a database.** This is a single-user, local-first tool. Plain
   JSON can be diffed in git, and Claude skills and Node scripts can write it without a
   client library. All reads and writes go through `lib/store.ts`, which writes atomically
   (temp file, then rename). To move to Postgres, SQLite or Supabase, re-implement
   `lib/store.ts` and nothing else changes. One limit: serverless hosts such as Vercel have
   a read-only filesystem, so writes need a real database there.
3. **Sample data is labelled, never passed off as real.** Every data file has
   `meta: { sample, source, updatedAt }`. While `sample` is true, the page shows a pink
   "sample data" notice and the trending cards carry a `sample` badge. Real writers (the
   scrapers, `/script`, the forms) set `sample: false`. `npm run seed` is deterministic: a
   seeded PRNG anchored to 2026-11-11, with no reads of the clock.
4. **Server components read, client components interact.** Pages are async server
   components with `dynamic = "force-dynamic"`, so they always read fresh files.
   Interactive pieces (filters, dialogs, the composer, charts) are client components.
   Mutations use server actions (`app/actions/*`) plus `revalidatePath`. The API routes
   (`app/api/*`) exist for outside writers: `/script`, scripts and future webhooks.
5. **Claude for writing tasks, with a deterministic fallback** (`lib/ai.ts`):
   - Model `claude-opus-5-5` at `effort: "low"`, because these are short writing tasks.
     Raise the effort if captions feel thin.
   - Structured outputs (`betaZodOutputFormat`) guarantee the JSON shape.
   - Server-side refusal fallbacks are on (`fallbacks: "default"`, beta
     `server-side-fallback-2026-07-01`).
   - Any failure (no key, rate limit, refusal) falls back to rule-based templates. The UI
     says which path ran, so the dashboard works with no key at all.
6. **Hook templating:** specifics are swapped for `[placeholders]`. Claude does this when
   it's available, otherwise regexes for tools, numbers, years and durations
   (`heuristicTemplate`). The format is classified as one of eight hook formats
   (`HookFormat`).
7. **A "heater"** is a reel posted in the last 7 days with at least 2× the median views of
   all reels in the file (about the last 30 days). Heaters are ranked by
   `views/median × (1 + 10·save rate + 50·follow rate)`, so saves and follows count more
   than raw reach (`lib/analytics.ts`). KPIs compare the last 7 days with the 7 before.
8. **Competitor outlier score** is a reel's views divided by that creator's own median. A
   small creator's 5× matters more than a big creator's average reel. The scrape uses
   Apify's Instagram Reel Scraper, because Instagram has no API for other people's
   content. The field mapping in `toReel` should be checked against one real run: the raw
   output is saved as `data/competitors.raw.json`, which git ignores.
9. **Hook potential** (What's trending) is a transparent 0–100 rule score in
   `lib/hook-potential.ts`, not an LLM call:
   - Points for stakes, novelty, recognisable names, numbers/versus, and recency.
   - ≥ 45 is high and ≥ 25 is medium.
   - Each item also gets a ready-to-say `hookIdea`.
   - The 12 sources are public RSS feeds listed in `lib/trend-sources.ts`. Edit that list
     to change them. Anthropic isn't on it because it has no RSS feed.
10. **Scheduling stores the queue. It doesn't publish.** "Schedule on N platforms" saves
    one post with a caption per platform to `data/scheduled.json`. Actual publishing is a
    separate step, through a scheduling provider. Metricool is recommended: its API (and
    the Metricool connector in Claude) can create scheduled posts across IG, TikTok, YT,
    LinkedIn and X. Direct platform APIs would mean five OAuth apps and app reviews. Each
    platform has a caption limit in `PLATFORMS` (`lib/types.ts`), and the composer counts
    characters against it.
11. **The calendar is a month grid on desktop and an agenda list on phones.** Weeks start
    on Monday. Status colours run from muted (idea) to full red (posted).
12. **Dates are stored as ISO strings and rendered in UTC** with the `en-GB` locale, so the
    server and client render the same text. The one exception is scheduled post times,
    which are local-time instants and are marked `suppressHydrationWarning`.

## Not wired yet (next steps)

- **Instagram analytics:** replace the sample `data/analytics.json`. Two options:
  - The Instagram Graph API: a business or creator account linked to a Facebook page,
    calling `/{ig-user-id}/media` and `/insights` with metrics `views`, `saved`, `shares`
    and `follows`.
  - Metricool's analytics API.
  Write a `scripts/fetch-analytics.ts` that produces `AnalyticsFile`.
- **Publishing** the scheduler queue through Metricool (decision 10).
- **Scheduling the scripts:** run `trending:fetch` hourly and `scrape:competitors` every
  Monday, with cron, GitHub Actions or a Claude Code scheduled task.
- **Auth:** none, because it's meant to run locally. Add it before deploying anywhere
  public.

## Conventions

- Shared types live in `lib/types.ts`. Every writer must produce these shapes.
- Put new UI primitives in `components/ui/` (shadcn style). Page-only components sit next
  to their page, e.g. `app/scheduler/composer.tsx`.
- Use the brand tokens (`bg-primary`, `text-brand-ink`, `bg-chart-3`…), never raw hex values
  in components.
- Before you're done, run `npm run typecheck` and `npm run build`. Check the pages at
  390px wide: no horizontal page scroll is allowed. Tables scroll inside their card.
