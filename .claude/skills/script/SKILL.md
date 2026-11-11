---
name: script
description: Write a short-form reel or carousel script for the clear code. (@theclearcode), then put it on the dashboard's content calendar with its date, time, platforms, hook, angle and CTA. Use when the user types /script (with a topic, a --hook from the hook vault, or nothing to take the next queued hook) or asks for a reel/carousel script.
---

# /script — write a script and put it on the calendar

## Inputs

All are optional; ask only if there's no topic, no `--hook` and an empty queue.

- a topic: `/script context windows`
- `--hook "<template>" --from <hookId>`: sent by the hook vault's "use this" button
- `--date YYYY-MM-DD`, `--time HH:MM`, `--format reel|carousel`, `--platforms instagram,tiktok`

**No topic and no `--hook`:** take the oldest item in `dashboard/data/script-queue.json`
(`queue[0]`). It holds a hook template, the original transcript and its niche.

**After using a queued hook (or a `--from` hook):** remove that item from `queue` in the same
file.

## 1. Pick the hook

- **If a hook template was given:** fill its `[slots]` for this topic and keep the template's
  structure. For example, "[x] just killed [y]" becomes "this protocol just killed the one-size-fits-all acne plan".
  Use the original transcript only to understand why the template worked.
- **If no template was given:**
  1. Read `dashboard/data/hooks.json` and favour high-`views` templates in a relevant niche.
  2. Read `dashboard/data/trending.json`, taking items tagged `"hook potential"` first.
  3. Write 3 options and choose the strongest.
- Every hook: under 12 words, lower-case, in the brand voice (`brand/BRAND.md`: between
  professional and playful, feminine, bold, warm).
- The audience is skin and acne specialists and clinic owners: The Clear Code Protocol
  helps them build and run acne programmes in their clinics. Make no medical claims and
  promise no skin results.

## 2. Write the script

Save it to `content/scripts/<date>-<slug>.md` at the repo root:

```markdown
---
title: <lower-case title>
date: YYYY-MM-DD
time: "HH:MM"
format: reel            # or carousel
platforms: [instagram, tiktok]
hook: <the hook, exactly as spoken / slide 1>
angle: <one sentence: the take or visual idea that makes it different>
cta: <the closing ask: save / follow / comment "x">
from_hook: <hookId, if one was used>
---
## hook (0–3s)
## setup (3–10s)
## body (10–45s)        — 3 beats max, one idea each
## cta (last 3s)
## on-screen text
## b-roll / visuals
```

For a reel, the spoken script runs 45–60 seconds (about 130–160 words).

For a carousel, use `## slide 1` … `## slide N` sections instead (6–10 slides, slide 1 = the
hook, last slide = the CTA). Carousels go to Instagram, and to TikTok only if asked, as a
photo post.

## 3. Put it on the content calendar

**Date and time:**
- Use `--date`/`--time` if given.
- Otherwise use the next date after today in `dashboard/data/calendar.json` with no entry,
  at 18:00. Use 12:30 for carousels.

**If the dashboard is running**, POST the entry. The server validates it and refreshes the
calendar and scheduler:

```bash
curl -s -X POST http://localhost:3000/api/calendar -H 'content-type: application/json' -d '{
  "date": "YYYY-MM-DD", "time": "18:00", "title": "...", "format": "reel",
  "platforms": ["instagram","tiktok"], "hook": "...", "angle": "...", "cta": "...",
  "status": "scripted", "source": "script", "scriptPath": "content/scripts/<file>.md",
  "captions": { "instagram": "...", "tiktok": "..." }
}'
```

**Otherwise**, edit `dashboard/data/calendar.json` directly:
- Append to `entries` an object matching `CalendarEntry` in `dashboard/lib/types.ts`.
- Give it an `id` of the form `cal_<8 random hex>`, with `status: "scripted"` and
  `source: "script"`.
- Keep `entries` sorted by date then time.

**Captions:** add a `captions` object to the entry, with one caption per platform in
`platforms`. You write these yourself; the user's Claude subscription covers it, so no API
key is needed.
- **instagram:** the hook as the first line, 2–4 short lines delivering the angle, the CTA,
  then 3–5 hashtags from
  `#acnespecialist #skinspecialist #acnetreatment #skinclinic #theclearcode`. For a
  carousel, add "swipe →".
- **tiktok:** the hook in one line, one line of angle, the CTA, then 2–3 of those hashtags.
  Under 300 characters.
- Write them lower-case, in the same voice. Captions in the entry are used as-is when the
  user clicks "schedule" in the scheduler.

**Re-running /script** for the same title and date updates that entry: reuse its `id`.

The scheduler picks the entry up under "ready to schedule", with your captions. Nothing posts
until the user approves it and runs `/metricool send`.

## 4. Reply

Include:
- the hook, plus the 2 runners-up if you wrote options
- the file path
- the calendar slot (date, time, platforms)
- whether a queued hook was used and removed from the queue
