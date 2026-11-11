---
name: competitors
description: Fill the clear code.'s online dashboard competitor tracker from screenshots of competitors' Instagram profiles and reels tabs (view counts, cover text, follower counts) — the free route, since the Metricool plan has no competitor tracking. Use when the user types /competitors or sends screenshots of other creators' Instagram reels.
---

# /competitors — competitor reels from screenshots

The dashboard lives online at **https://claude.ai/artifact/C377BSo7rK7oopk2gX1C1K**. Its
competitor data is one document, `competitors`/`state` (`{meta, creators, reels}`), in that
page's database. Read and write it with the **ArtifactData** tool.

You read the screenshots yourself: no API, no paid tool. The user is on an iPad and doesn't
want new subscriptions.

## What the user sends

Screenshots from the Instagram app:
- **Profile header:** the @handle, display name and follower count.
- **Reels tab** (the grid): each tile shows a play/eye icon with the view count, and usually
  the cover text, which is the hook.

If they type `/competitors` without screenshots, ask for them in plain words:
1. Screenshot the top of the profile, so the follower count shows.
2. Tap the reels tab and screenshot the grid.
3. Send them here.

## What to do

1. **Read the screenshots.** For each account, read the @handle and the follower count
   ("12.5K" = 12500, "1.2M" = 1200000). For each reel tile, read the **views** by the icon
   and the **hook**, which is the cover text exactly as written.
   - Skip tiles with no readable cover text, or whose number is cut off. Never estimate.
   - Keep the **top 5 by views per account** unless the user wants every tile.
2. **Write the new reels** to `/tmp/competitor-reels.json`:
   `[{ "creator": "@handle", "creatorName": "…", "followers": 12500, "hook": "…", "views": 48000 }]`.
   Add `likes`, `comments`, `url` or `postedAt` only when a screenshot shows them.
3. **Get the current state.** Use ArtifactData `get` on `competitors`/`state` with
   `out_dir` = `/tmp/comp`, and note its `version`.
4. **Merge.** In `dashboard/`, run
   `node scripts/online/competitors-merge.mjs /tmp/comp/competitors/state.json /tmp/competitor-reels.json > /tmp/comp-merged.json`.
   The same reel again (same account and hook) updates its numbers.
5. **Write back.** Use ArtifactData `set` on `competitors`/`state` with `file_path`
   `/tmp/comp-merged.json` and `if_version`.
6. **Reply with:**
   - the accounts and reels added or updated
   - the top 3 hooks by views
   - anything you couldn't read, and why

   Remind the user once that "save to hook vault" on the dashboard turns any of these into a
   template.

There's no automatic weekly scrape on this free route. Suggest sending fresh screenshots of the
same accounts each Sunday.

Accounts already tracked as of 11 Nov 2026: @functionalskinacademy, @the_skinspecialist and
@advancedacneacademy. @ell.skinn's reels tab showed no view counts, so none were added.
