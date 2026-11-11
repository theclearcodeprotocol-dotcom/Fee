---
name: script
description: Write a short-form video script for the clear code. (@theclearcode) on a topic, then add it to the content calendar in the dashboard with its hook and angle. Use when the user types /script <topic> or asks for a reel/TikTok script.
---

# /script — write a reel script and put it on the calendar

Input: a topic, optionally a date (`/script context windows --date 2026-11-20`) and platforms.

## 1. Pick the hook
- Read `dashboard/data/hooks.json` (hook vault) and `dashboard/data/trending.json`
  (items with `"potential": "high"` first) for templates and fresh angles.
- Write 3 hook options, each under 12 words, lower-case, brand voice (see `brand/BRAND.md`:
  between professional and playful, bold, warm). Choose the strongest and say why in one line.

## 2. Write the script
Save to `content/scripts/<date>-<slug>.md`:

```markdown
---
title: <lower-case title>
date: YYYY-MM-DD
hook: <the chosen hook, exactly as spoken>
angle: <one sentence: the take, format or visual idea that makes it different>
platforms: [instagram, tiktok, youtube]
---
## hook (0–3s)
## setup (3–10s)
## body (10–45s)   — 3 beats max, one idea each
## cta (last 3s)   — save / follow / comment prompt
## on-screen text
## b-roll / visuals
```

Keep the spoken script 45–60 seconds (≈130–160 words).

## 3. Add it to the content calendar
Date: the one given, else the next empty day in `dashboard/data/calendar.json` after today.

If the dashboard dev server is running, POST to it (it validates and refreshes the page):

```bash
curl -s -X POST http://localhost:3000/api/calendar -H 'content-type: application/json' -d '{
  "date": "YYYY-MM-DD", "title": "...", "hook": "...", "angle": "...",
  "platforms": ["instagram","tiktok","youtube"], "status": "scripted",
  "source": "script", "scriptPath": "content/scripts/<file>.md"
}'
```

Otherwise edit `dashboard/data/calendar.json` directly: append to `entries` an object with the
`CalendarEntry` shape from `dashboard/lib/types.ts` (`id` like `cal_<8 random hex>`,
`status: "scripted"`, `source: "script"`), keep `entries` sorted by `date`, and set
`meta.sample` to `false`.

Re-running /script for the same title and date updates that entry instead of adding a second
(reuse its `id`).

## 4. Reply
The chosen hook, the 2 runners-up, the file path, and the calendar date.
