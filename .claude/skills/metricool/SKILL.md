---
name: metricool
description: Sync the clear code.'s online content dashboard with Metricool — pull Instagram and TikTok analytics into it, and send the posts the user approved on its scheduler to Metricool to publish. Use when the user types /metricool, /metricool pull, /metricool send, or asks to refresh analytics or send approved posts.
---

# /metricool — the online dashboard's link to Metricool

The dashboard lives online at **https://claude.ai/artifact/C377BSo7rK7oopk2gX1C1K**. It's a
page on the user's Claude account, and its data is in that page's database, which you read
and write with the **ArtifactData** tool (`url` = that link).

Metricool is reached through the Metricool connector tools
(`mcp__Metricool_Social_Media_Management__*`): brand id `7976989` (theclearcode_), timezone
`Europe/London`. Instagram (@theclearcode_) and TikTok (@theclearcode_acne) are both
connected.

Helper scripts live in the repo's `dashboard/` folder. Run `npm install` there once if
`node_modules` is missing.

- `/metricool` with no argument does **pull**, then **send**.
- Everything here runs on the user's existing Claude and Metricool accounts. Don't suggest paid
  add-ons. The user has asked for no new subscriptions.
- The user works on an iPad: give results in plain words, never terminal instructions.

## pull — analytics → dashboard

1. **Fetch.** Call `getAnalyticsDataByMetrics` four times with brandId `7976989`,
   `from` = 180 days ago and `to` = now. Use metrics **exactly in these orders**, saving
   each raw response unchanged into `dashboard/data/metricool/`. Write each file with
   `node -e` and `JSON.stringify` so captions stay valid JSON.
   - Instagram daily: `["IGEV05","IGEV29","IGEV15","IGEV43"]` → `evolution.json`
   - Instagram reels:
     `["IGRE02","IGRE03","IGRE04","IGRE06","IGRE23","IGRE12","IGRE21","IGRE07","IGRE11","IGRE27","IGRE30"]`
     → `reels.json`
   - TikTok daily: `["TKEV12","TKEV16","TKEV13","TKEV15"]` → `tiktok-evolution.json`
   - TikTok videos: `["TKPO02","TKPO05","TKPO03","TKPO07","TKPO08","TKPO09","TKPO10","TKPO11","TKPO13","TKPO16"]`
     → `tiktok-videos.json`
2. **Get the current numbers.** Use ArtifactData `get` on `analytics`/`instagram` and
   `analytics`/`tiktok` with `out_dir` = `dashboard/data/online`, and note each document's
   `version`. Copy the files to `dashboard/data/analytics.json` and
   `dashboard/data/analytics-tiktok.json`. The import keeps earlier days and notes from them.
3. **Import.** Run `npm run -s metricool:import` in `dashboard/`.
4. **Notes.** If it lists heaters needing a note, write one line per reel or video (under 18
   words, lower-case) on what most likely made it pop. Base it only on the printed stats
   and the hook, and set it as `note` on that item in the local file it names.
5. **Write back.** Use ArtifactData `batch`:
   - `set` `analytics`/`instagram` from `file_path` `dashboard/data/analytics.json`, with
     `if_version`
   - `set` `analytics`/`tiktok` from `file_path` `dashboard/data/analytics-tiktok.json`,
     with `if_version`
6. **Tell the user**, per platform: the dates now covered, the last 7 days' views, the number
   of reels or videos, and any new heaters with their notes.

Metricool has no DM numbers, no per-reel follows and no TikTok saves. The page says so; never
invent them.

## send — approved posts → Metricool

Only posts the user approved on the dashboard go out. Never approve a post yourself, and never
send one that `posts-ready` doesn't list.

1. Call `getBrandSettings` and note the connected networks (`networksData`).
2. Use ArtifactData `list` on `posts`, with `out_dir` = `dashboard/data/online` and
   `query.limit` 200. Keep each document's `version` from the result.
3. Run `node scripts/online/posts-ready.mjs data/online/posts` in `dashboard/`. It prints:
   - `ready`: items to send, each `{ postId, platform, title, blogId, date, info }`
   - `stale`: posts edited since they were approved
   - `skipped`: posts with a reason they can't go
4. **Each `stale` post:** ArtifactData `update` it to `{"status": "pending_approval",
   "approvalKey": {"__delete__": true}, "approvedAt": {"__delete__": true}}`, with
   `if_version`. Tell the user it needs approving again.
5. **Each `ready` item:**
   - **Platform not connected:** don't call Metricool. Record
     `results.<platform> = {"ok": false, "error": "<platform> isn't connected in metricool", "at": now}`.
   - **Otherwise:** call `createScheduledPost` with `blogId`, `date` and `info` passed through
     unchanged. On success, record
     `results.<platform> = {"ok": true, "id": <id>, "url": <plannerUrl>, "at": now}`.
   - **On error:** don't retry with changed content. Record `{"ok": false, "error": <message>}`
     and leave the status `approved`, so the next send tries again.
6. **Record the results:** ArtifactData `update` per post, with `if_version`, writing its
   `results`. Once every one of its platforms has a result and at least one is `ok`, also
   set `"status": "in_metricool"`, and `update` its calendar entry (`calendar`/`<calendarEntryId>`)
   to `"status": "scheduled"`.
7. **Reply with:**
   - what was scheduled: title, platform, London time and planner link
   - what was skipped, and why
   - any errors

Media links must be reachable by Metricool. Google Drive or Dropbox links set to "anyone with
the link" work. If Metricool rejects one, tell the user to change the sharing and approve
again.
