---
name: metricool
description: Sync the clear code. content dashboard with Metricool — pull Instagram analytics and competitor reels into the dashboard, and send the posts the user approved in the dashboard's scheduler to Metricool to publish. Use when the user types /metricool, /metricool pull, /metricool competitors, /metricool send, or asks to refresh analytics/competitors or send approved posts.
---

# /metricool — the dashboard's link to Metricool

The dashboard can't reach Metricool itself. You can, through the Metricool connector tools
(`mcp__Metricool_Social_Media_Management__*`). Work in the `dashboard/` folder.

- Brand id `7976989` (theclearcode_), timezone `Europe/London`. Both are in
  `dashboard/lib/metricool.ts`.
- `/metricool` with no argument does **pull**, then **competitors**, then **send**.
- Everything here runs on the user's existing Claude and Metricool accounts. Don't suggest paid
  add-ons (Claude API key, Apify); the user has asked not to take on new subscriptions.

## pull — Instagram analytics → analytics page

1. Call `getAnalyticsDataByMetrics` with brandId `7976989`, `from` = 180 days ago, `to` = now,
   and metrics **exactly in this order**: `["IGEV05","IGEV29","IGEV15","IGEV43"]`.
   Save the raw JSON response, unchanged, to `dashboard/data/metricool/evolution.json`.
2. Call it again for the same dates with metrics **exactly in this order**:
   `["IGRE02","IGRE03","IGRE04","IGRE06","IGRE23","IGRE12","IGRE21","IGRE07","IGRE11","IGRE27","IGRE30"]`.
   Save the raw response to `dashboard/data/metricool/reels.json`. Write it with a small
   `node -e` script and `JSON.stringify`, so captions with quotes and emoji stay valid JSON.
3. Run `npm run -s metricool:import`.
4. If it lists heaters needing a note:
   - Write one line per reel (under 18 words, lower-case) saying what most likely made it
     pop. Base it only on the stats printed (skip rate, save/share/comment rates against the
     medians) and the hook.
   - Set it as `note` on that reel in `dashboard/data/analytics.json`.
5. Tell the user the date range now covered, the number of reels, and any new heaters with
   their notes.

Metricool provides no DM numbers and no per-reel follows. The page says so; don't invent them.

## competitors — Metricool competitor reels → competitor tracker

1. Call `getAnalyticsDataByMetrics` with brandId `7976989`, `from` = 30 days ago, `to` = now,
   and metrics **exactly in this order**: `["IGCO02","IGCO03","IGCO07"]`. Save the raw
   response to `dashboard/data/metricool/competitors.json`.
2. Call it again for the same dates with metrics **exactly in this order**:
   `["IGCR01","IGCR02","IGCR03","IGCR04","IGCR06","IGCR07","IGCR08"]`. Save the raw
   response to `dashboard/data/metricool/competitor-reels.json`, written with
   `node -e` and `JSON.stringify`.
3. Run `npm run -s metricool:competitors`.
4. **If it says there are no competitors:** tell the user to add the accounts they follow in
   Metricool (Competitors → Instagram → add). That's free within their current Metricool
   plan, up to its competitor limit.
5. Reply with how many accounts and reels came in, and the top 3 hooks by likes.

Metricool doesn't share competitors' view counts or videos. So reels are ranked by likes, the
hook is the caption's first line, and there's no transcript or on-screen text. Say so if
asked; don't estimate views.

## send — approved posts → Metricool

Only posts the user approved in the dashboard go out. Never approve a post yourself, and
never send one that `ready` doesn't list.

1. Call `getBrandSettings` and note which networks are connected (`networksData`). Today
   only Instagram is connected.
2. Run `npm run -s metricool:posts -- ready`. It prints a JSON list of
   `{ postId, platform, title, blogId, date, info }`. Posts edited since approval are sent
   back for approval automatically and won't appear.
3. For each item:
   - **Platform not connected in Metricool** (e.g. TikTok): don't call Metricool. Run
     `npm run -s metricool:posts -- skip <postId> <platform> "tiktok isn't connected in metricool"`.
   - **Otherwise:** call `createScheduledPost` with `blogId`, `date` and `info` passed through
     **unchanged** (`info` is already the JSON string Metricool expects). On success, run
     `npm run -s metricool:posts -- mark <postId> <platform> <id from the response> <plannerUrl from the response>`.
   - **On error:** don't retry with altered content. Report the error and leave the post
     approved, so the next `/metricool send` tries again.
4. Reply with what was scheduled (title, platform, London time, planner link), what was
   skipped and why, and any errors.

Media must be reachable by Metricool. Google Drive or Dropbox share links work; Metricool
uploads them itself. If Metricool rejects a media link, tell the user to set the file to
"anyone with the link" and re-approve.
