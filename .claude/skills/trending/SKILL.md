---
name: trending
description: Pull today's AI news from the 12 sources into the clear code.'s online dashboard "what's trending" page, each story tagged "hook potential", "explainer" or "skip" with a first line to film. Use when the user types /trending or asks what's trending in AI news today.
---

# /trending — today's AI news → the dashboard

The dashboard lives online at **https://claude.ai/artifact/C377BSo7rK7oopk2gX1C1K**. Its
news is one document, `trending`/`state` (`{meta, sources, items}`), in that page's database.
Read and write it with the **ArtifactData** tool.

The 12 sources, with ids and feed links, are in `dashboard/lib/trend-sources.ts`:
openai, deepmind, google-ai, huggingface, verge, techcrunch, mit-tr, venturebeat, ars,
wired, hn, reddit-ai.

## What to do

1. **Gather.** For each source, get its stories from the **last 48 hours**:
   - Use WebFetch on its feed `url`. If that fails, use its `home` page, or WebSearch
     restricted to that site.
   - Take each story's title, link, publish time and a one-sentence summary in your own
     words, and keep up to 6 per source.
   - Never invent a story, date or link. If a source can't be reached, skip it and say so.
2. **Tag every story** for a creator whose audience is skin and acne specialists and clinic
   owners, and who uses AI in their business:
   - `hook potential`: someone would stop scrolling in 2 seconds (personal stakes, a famous
     name, a surprising number, news they'll hear elsewhere today, or a direct effect on
     clinics, skincare or small businesses).
   - `explainer`: worth covering, but needs a slower "here's what this means" video.
   - `skip`: niche, incremental, or irrelevant to that audience.

   Give each story a one-line `reason` (under 15 words) and a `hookIdea`: a lower-case
   first line to say to camera, under 20 words, with no medical claims.
3. **Build the document.** Write the stories to `/tmp/stories.json` as
   `[{ "sourceId", "title", "summary", "url", "publishedAt", "tag", "reason", "hookIdea" }]`.
   Then, in `dashboard/`, run
   `node scripts/online/trending-build.ts /tmp/stories.json > /tmp/trending-state.json`.
   It adds ids and scores, removes duplicate links and fills any gaps with the built-in rules.
4. **Save.** Use ArtifactData `get` on `trending`/`state` for its `version`, then `set` it
   from `file_path` `/tmp/trending-state.json` with `if_version`.
5. **Reply with:**
   - the top 5 "hook potential" stories, newest first, each with its hook idea
   - how many sources were reached

   The user chose not to use Slack, so the page and this reply are where they see it.
