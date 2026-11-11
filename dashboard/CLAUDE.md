# the clear code. — content dashboard

This is the content dashboard for @theclearcode. It has six pages and a set of scheduled
jobs, all in this folder. The repo root is a separate HyperFrames video project with its own
CLAUDE.md, and none of that project's rules (GSAP timelines, `npm run check`) apply here.

| Page | Route | Data | Filled by |
|---|---|---|---|
| hook vault | `/hooks` | `data/hooks.json`, `data/script-queue.json` | "add hook", `npm run hooks:transcribe`, "save to hook vault" on the competitor page |
| analytics | `/analytics?range=7\|30\|90` | `data/analytics.json` | `analytics:fetch`, daily 05:30 |
| competitor tracker | `/competitors` | `data/competitors.json` | `scrape:competitors`, Sunday 06:00 |
| scheduler | `/scheduler` | `data/scheduled.json` | "schedule with claude" (from calendar entries), then your approval; `publish:due` every 5 min |
| content calendar | `/calendar?month=YYYY-MM` | `data/calendar.json` + `../content/scripts/*.md` | the `/script` skill (`../.claude/skills/script/SKILL.md`), "quick post" |
| what's trending | `/trending` | `data/trending.json` | `trending:fetch` daily 06:40; `trending:slack` at 07:00 |

## How the pieces connect

```
competitor scrape ──save to hook vault──▶ hook vault ──use this──▶ /script ──▶ calendar entry (+ script file)
trending (hook potential) ─────────────────────────────────────────▲               │
                                                                         scheduler: claude drafts captions
                                                                         from hook + angle + cta
                                                                                       │ you approve
                                                                         publish:due ──▶ Instagram / TikTok
analytics ◀── Instagram (daily)                                                         │
                                                                         calendar entry → posted
```

## Stack

- **Next.js 16** (App Router, React 19, Turbopack) with **TypeScript 5**. TS 7 is skipped
  because Next's type-check step still uses the TS 5 API.
- **Tailwind CSS v4**, configured CSS-first in `app/globals.css` (`@theme inline`, no
  `tailwind.config`).
- **shadcn/ui** (new-york style, unified `radix-ui` package, lucide icons). Components live in
  `components/ui/`. `components.json` is set up, so `npx shadcn@latest add <name>` works. The
  first components were written by hand from shadcn's source because the build sandbox
  couldn't reach the registry.
- **Recharts** for the sparklines (`app/analytics/sparkline.tsx`).
- **zod v4** checks every input (`lib/schemas.ts`).
- **@anthropic-ai/sdk** for captions, hook templates, on-screen text, trend tags and heater
  notes (`lib/ai.ts`).
- **Node ≥ 22.18.** Jobs in `scripts/*.ts` run with plain `node` (built-in type stripping) and
  load `.env.local` via `--env-file-if-exists`. Anything a script imports from `lib/` must use
  explicit `.ts` extensions on relative imports (`allowImportingTsExtensions` is on) and must
  not use the `@/` alias. `lib/media.ts` and `lib/publish/*` are script-only.
- **ffmpeg** for the competitor scrape and `hooks:transcribe`.

```bash
npm install
npm run dev                         # http://localhost:3000
npm run build && npm start
npm run typecheck
npm run seed                        # deterministic SAMPLE data in data/*.json
npm run data:clear-sample           # empty the samples once real sources are connected

npm run hooks:transcribe -- clip.mp4 --creator @handle [--niche "ai tools"]
npm run analytics:fetch
npm run scrape:competitors
npm run trending:fetch
npm run trending:slack [-- --print]
npm run publish:due [-- --dry-run]
npm run schedule:install            # put all of the above on their timers (crontab)
npm run schedule:remove
```

### Environment (`.env.local`, gitignored)

| Var | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | everything Claude does. Optional: without it every feature falls back to rules or templates and the UI says so |
| `ELEVENLABS_API_KEY` | transcription (added by the network proxy in Fee cloud sessions) |
| `APIFY_TOKEN` | competitor scrape |
| `IG_USER_ID`, `IG_ACCESS_TOKEN` | analytics pull and Instagram publishing. Scopes: `instagram_basic`, `instagram_manage_insights`, `instagram_content_publish`, and optionally `instagram_manage_messages` for DM volume |
| `IG_GRAPH_VERSION` | Graph API version, default `v23.0` |
| `TIKTOK_ACCESS_TOKEN` | TikTok publishing (`video.publish` scope) |
| `TIKTOK_PRIVACY_LEVEL` | optional, e.g. `SELF_ONLY` while the TikTok app is unaudited |
| `SLACK_WEBHOOK_URL` | 7am digest (Slack app → Incoming Webhooks → your channel or DM) |
| `DASHBOARD_URL` | link in the Slack digest, default `http://localhost:3000` |
| `TZ` | timezone for calendar times and cron, if the machine's timezone isn't yours |

`IG_GRAPH_BASE`, `TIKTOK_API_BASE` and `PUBLISH_POLL_MS` exist only to point the publishers at
a mock server in tests.

## Brand (from `../brand/BRAND.md`)

- **Palette:** red `#AE1F14`, cream `#F2F0E0`, pink `#FFD7DE`, with white as an accent only.
  These are tokens in `app/globals.css` (`--brand-*`) mapped onto the shadcn variables:
  `--primary` is red, `--background` is cream, `--secondary`/`--accent` are pink.
- **Derived colours only, never new hues:** `--brand-ink #2A1210` (red at very low lightness)
  is the body text colour, because long text in full red is tiring. Red is kept for headings
  and accents. `--brand-red-deep` is the hover colour. The chart tints `--chart-2..5` are red
  and pink tints.
- **Type:** headings use Source Serif 4 Black at -0.05em, via `next/font/local` from
  `app/fonts/` (OFL). Body text uses Outfit, self-hosted through `@fontsource-variable/outfit`.
- **Sidebar:** red, with **@theclearcode** at the top in the serif, a pink pill for the
  active page, and the `c.` lettermark at the bottom.
- **Copy:** lower-case UI text. No dark mode (the brand is a light cream ground).

## Decisions

1. **Self-contained app in `dashboard/`.** `next.config.ts` pins the turbopack and
   output-tracing roots here so the parent HyperFrames project isn't picked up.

2. **JSON files instead of a database.** This is a single-user, local-first tool.
   - All reads and writes go through `lib/store.ts`: atomic temp-file-plus-rename writes, and
     `mutate()` serialises read-modify-write per file within a process.
   - The web app and a cron job can still race on the same file. The scheduler's approval
     fingerprint (decision 7) means a race can't cause an unapproved publish.
   - To move to a database, re-implement `lib/store.ts`.
   - Serverless hosts have read-only disks, so deploying needs a database first.

3. **Sample data is labelled, never passed off as real.** Every data file carries
   `meta.sample`. While it's true, the page shows a pink "sample data" notice and the Slack
   digest warns too. Real jobs set `sample: false`. The seed is deterministic: seeded PRNG,
   anchored to 2026-11-11. The sample creator handles end in `.demo`; replace them in
   `data/competitors.json` → `creators` with the 8 accounts you follow.

4. **Hook vault.**
   - **Saving a hook:** each save is templatised. Claude handles this when available.
     Otherwise `heuristicTemplate()` recognises named archetypes first (`[x] just killed [y]`,
     `stop doing [x]`, `[number] things i wish i knew …`, `nobody is talking about [x]`,
     `if you're [audience], …`, `pov: [x]`), then swaps tools, numbers, years and durations
     for slots.
   - **Niche:** comes from the creator (competitor saves), the form, or Claude's guess.
   - **Search:** free text, niche, a minimum view count and sort order. Templates that appear
     more than once show up as "proven shapes" filters.
   - **"Use this":** queues the hook in `data/script-queue.json` and copies
     `/script --hook "<template>" --from <id>` to the clipboard. `/script` with no arguments
     takes the oldest queued hook. A web page can't type into Claude Code, so the queue plus
     clipboard is the hand-off.

5. **Analytics.**
   - The 7/30/90-day ranges come from the URL (`?range=`). Each metric card shows the total,
     the change against the previous equal period (shown only when a full previous period
     exists, so the file keeps 180 days), and a daily sparkline.
   - **DMs** counts DM conversations with activity that day. Instagram has no "new DMs"
     metric; this comes from the Messaging API.
   - **Heater:** a reel whose views are at least 2× the median of your reels posted in the 30
     days before it went up (`lib/analytics.ts`). With fewer than 3 reels in that window it
     uses all earlier reels.
   - **Top heaters:** the top 5 heaters in the selected range, sorted by views. Every reel in
     the range appears in the table with a heater flag.
   - **"What made it pop":** written by Claude during the daily pull, based on the reel's
     rates against your medians and its hook. Without Claude, `popNote()` picks whichever
     rate stands out most and names the hook shape.

6. **Competitor tracker.**
   - Uses Apify's reel and profile scrapers, because Instagram has no API for other
     accounts.
   - Picks the top 5 per account by views from the last 7 days, topped up from the last 30.
   - Each reel is downloaded and transcribed by ElevenLabs (first 15 seconds). The hook is the
     first spoken sentence. Claude vision reads the on-screen text from frames at 0.4, 1.2
     and 2.5 seconds.
   - Music-only reels fall back to the on-screen text, then the caption.
   - The page sorts all reels by views.
   - Apify field names may drift. The raw output is kept in `data/competitors.raw.json`.

7. **Scheduler: Claude drafts, you authorise.**
   - **Drafting:** "schedule with claude" (or "schedule all ready") turns a
     scripted/filmed/edited calendar entry into a post with Instagram and TikTok captions
     written from hook + angle + CTA. The post starts as `pending_approval`.
   - **Approval:** clicking approve checks the captions (present, within limits), the media
     (1 video for a reel, 2–10 images for a carousel) and that the time is in the future. It
     then stores a fingerprint of everything that would go out (`approvalKey`).
   - **Publishing:** `publish:due` only sends `approved` posts whose fingerprint still
     matches. Any later edit, by you or a stray write, sends the post back for approval
     instead of publishing it. Platforms that succeeded are never re-posted on retry.
   - **Media:** given as public HTTPS URLs, because both APIs pull media from a URL. TikTok
     also requires that domain to be verified in its developer portal. Uploading files needs
     storage (R2 or S3, for example) and isn't built yet.
   - **Platform APIs:** the Instagram Content Publishing API (reels and image carousels) and
     the TikTok Content Posting API (video, and photo posts for carousels). Until TikTok
     audits the app, posts can only be private.
   - **Times:** calendar times are your wall-clock time, read in the machine's timezone
     (`TZ`).

8. **Content calendar.** A month grid shows each slot's time, platforms (IG/TT) and hook,
   coloured by status. Clicking a slot opens a right-hand panel with the hook, angle and
   CTA, the full script, and the caption(s) once the post has been drafted.
   - The script is read from `scriptPath`, which must be under `content/scripts/`, with the
     YAML front matter removed. Sample entries carry the script inline.
   - On phones the grid becomes an agenda list and the panel goes full-width.

9. **What's trending.**
   - Pulled daily from the 12 RSS/Atom feeds in `lib/trend-sources.ts` (items from the last 48
     hours). Anthropic isn't on the list because it has no feed.
   - Each item is tagged `hook potential`, `explainer` or `skip`, with a one-line reason and a
     first line to say on camera. Claude tags the whole batch in one call. Without it, the
     rules in `lib/hook-potential.ts` decide: a score of 35 or more is hook potential, a
     concept or research piece is an explainer, everything else is skip.
   - The top section and the 07:00 Slack digest use the same `topHookItems()`: the 5 newest
     hook-potential items, newest first.

10. **Scheduling uses your crontab** (`scripts/install-schedule.sh`), in your machine's local
    time, with logs in `logs/`. It was chosen over GitHub Actions because the data lives in
    local files and the jobs need ffmpeg and your keys.
    - **Limit:** cron doesn't run while the machine is asleep. For 06:00 Sundays and 07:00
      Slack messages to be reliable, run it on an always-on machine, or move the jobs to a
      server alongside a database (decision 2).

## Verified vs not yet

- **Tested here:** every page renders, with no console errors and no horizontal scroll at
  390px. Also tested:
  - hook templating
  - "use this", including the queue and clipboard
  - "save to hook vault"
  - the approval gate, which rejects missing media and resets on edit
  - `publish:due` against a mock Instagram/TikTok server (reel and carousel, the tampered
    post refused, calendar entry marked posted)
  - the Slack digest against a mock webhook
- **Written to the documented APIs but never run against the live services** (the sandbox
  blocks them): the Instagram Graph insights and publishing calls, the TikTok Content
  Posting API, Apify actors, the RSS feeds, and the ElevenLabs and Claude calls. Expect to
  adjust a field name or two on the first real run. Each job logs what it couldn't read
  instead of failing silently.

## Conventions

- Shared types live in `lib/types.ts`, and every writer must produce those shapes.
- Put UI primitives in `components/ui/` (shadcn style). Page-only components sit next to
  their page.
- Use the brand tokens (`bg-primary`, `text-brand-ink`, `bg-chart-3`…), never raw hex values
  in components.
- Before finishing a change, run `npm run typecheck` and `npm run build`, and check the pages
  at 390px wide (tables scroll inside their card, never the page).
