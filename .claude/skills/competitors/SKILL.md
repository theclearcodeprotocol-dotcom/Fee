---
name: competitors
description: Fill the clear code. dashboard's competitor tracker from screenshots of competitors' Instagram profiles and reels tabs (view counts, cover text, follower counts) — the free route, since the Metricool plan has no competitor tracking. Use when the user types /competitors or sends screenshots of other creators' Instagram reels.
---

# /competitors — competitor reels from screenshots

The user's Metricool plan has no competitor tracking, and they don't want new subscriptions,
so this is how the competitor tracker gets its data. You read the screenshots yourself (no
API, no paid tool) and add the reels with `npm run competitors:add`. Work in `dashboard/`.

## What the user sends

Screenshots from the Instagram app:
- **Profile header:** the @handle, display name and follower count.
- **Reels tab** (the grid): each tile shows a play icon with the view count, and usually the
  cover text, which is the hook.
- **An open reel** (optional): likes, comments, the caption, sometimes the on-screen text.

If they type `/competitors` without screenshots, ask for them, in plain words:

1. Open the account in Instagram and screenshot the top of the profile, so the follower
   count shows.
2. Tap the reels tab (the play-button icon) and screenshot the grid.
3. Send those screenshots here. Several accounts at once is fine.

## What to do

1. For each account, read the @handle and the follower count from the header. Convert "12.5K"
   to 12500 and "1.2M" to 1200000.
2. For each reel tile in the grid:
   - **views:** the number by the play icon, converted the same way.
   - **hook:** the cover's text, exactly as written. If the cover has no readable text, skip
     that tile rather than guess. The grid shows no spoken words, so don't invent them.
   - **onScreenText:** the same cover text, if it differs from what you used as the hook.
3. Keep the **top 5 by views per account**. If the user wants every tile, take them all.
4. Write a JSON array to `/tmp/competitor-reels.json`, one object per reel:
   ```json
   [{ "creator": "@handle", "creatorName": "display name", "followers": 12500,
      "hook": "cover text", "views": 48000, "source": "screenshot" }]
   ```
   Add `likes`, `comments`, `caption`, `url` or `postedAt` only when a screenshot actually
   shows them. Never estimate a number you can't read. Leave the field out instead.
5. Run `npm run -s competitors:add -- /tmp/competitor-reels.json`. Adding the same reel again
   (same account and hook) updates its numbers, so a fresh screenshot next week refreshes the
   counts. The first real reel replaces the sample data.
6. Reply with:
   - the accounts and reels added or updated
   - the top 3 hooks by views
   - anything you couldn't read, and why

Remind the user once that "save to hook vault" on the competitor page turns any of these into
a template.

## Keeping it fresh

There's no automatic weekly scrape on this free route. Suggest that once a week (Sunday works
well) the user screenshots the same accounts' reels tabs and sends them with `/competitors`.
