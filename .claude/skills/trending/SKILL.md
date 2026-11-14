---
name: trending
description: Pull this week's skincare news — trade press, new research, UK rules, consumer beauty trends and the user's TikTok/Instagram screenshots — into the clear code.'s online dashboard "what's trending" page, each story tagged "hook potential", "explainer" or "skip" with a first line to film. Use when the user types /trending, /trending skincare, or asks what's trending in skincare, acne or aesthetics.
---

# /trending — this week's skincare news → the dashboard

The dashboard lives online at **https://claude.ai/artifact/C377BSo7rK7oopk2gX1C1K**. Its
news is one document, `trending`/`state` (`{meta, sources, items}`), in that page's database.
Read and write it with the **ArtifactData** tool.

The page is **skincare only** (the user removed AI news). The sources, with ids and links,
are in `dashboard/lib/trend-sources.ts`:

| id | what to look for |
|---|---|
| aesthetics-journal | UK aesthetics industry news |
| professional-beauty | UK salon and clinic business news |
| cosmetics-business | ingredient, brand and product launches |
| cosmeticsdesign | ingredient science and EU/UK regulation |
| beautymatter | beauty business, brands and trends |
| dermatology-times | dermatology practice and treatment news |
| research | new acne, rosacea and pigmentation papers (also feeds Clear Evidence) |
| bad | British Association of Dermatologists statements and campaigns |
| regulation | ASA rulings on skincare/aesthetics ads, MHRA and gov.uk (licensing, product recalls, banned ingredients) |
| consumer | what clients are reading: Vogue UK, Allure, Glamour UK skincare trends |
| social | TikTok Creative Center / Instagram Explore screenshots the user sends |

## What to do

1. **Gather** stories from the **last 7 days** (skincare news moves slower than tech). If that
   gives fewer than 8 stories, widen to 14 days and say so in the reply:
   - Try WebFetch on the source's `url`. In cloud sessions most of these hosts are blocked;
     then use WebSearch restricted to the site (`allowed_domains`), e.g. "acne", "skincare",
     "aesthetics", "ingredient", plus the month and year. For `research`, search PubMed or
     journal sites (jaad.org, onlinelibrary.wiley.com/journal/13652133 (BJD),
     jamanetwork.com/journals/jamadermatology) for new acne/rosacea/pigmentation studies.
   - If the user attached screenshots (TikTok Creative Center hashtags, Instagram Explore,
     a viral video), read them and add one story per clear trend under `social`, with the
     `url` of the hashtag or video if visible, else the Creative Center link.
   - Take each story's title, link, publish date and a one-sentence summary in your own
     words; keep up to 6 per source and aim for 10–20 overall.
   - Never invent a story, date or link. If a source can't be reached or has nothing that
     week, skip it and say so.
2. **Tag every story** for a creator whose audience is skin and acne specialists,
   aestheticians and clinic owners (UK), and who sells the clear code protocol and Clear Evidence:
   - `hook potential`: someone would stop scrolling in 2 seconds — a viral ingredient or
     TikTok trend clients will ask about, a ban/recall/ASA ruling, a surprising study result,
     a famous brand, or a direct effect on clinics and their clients.
   - `explainer`: worth covering, but needs a slower "here's what the evidence says" video or
     carousel (good Clear Evidence material).
   - `skip`: niche, incremental, US-only with no UK effect, or irrelevant to that audience.

   Give each story a one-line `reason` (under 15 words) and a `hookIdea`: a lower-case first
   line to say to camera, under 20 words. **No medical claims, no cure/guarantee language**
   (ASA/CAP rules): talk about what the evidence suggests and what to ask clients.
3. **Build the document.** Write the stories to `/tmp/stories.json` as
   `[{ "sourceId", "title", "summary", "url", "publishedAt", "tag", "reason", "hookIdea" }]`.
   Then, in `dashboard/`, run
   `node scripts/online/trending-build.ts /tmp/stories.json > /tmp/trending-state.json`.
   It adds ids and scores, removes duplicate links and fills any gaps with the built-in rules.
4. **Save.** Use ArtifactData `get` on `trending`/`state` for its `version`, then `set` it
   from `file_path` `/tmp/trending-state.json` with `if_version`. This replaces last week's list.
5. **Reply with:**
   - the top 5 "hook potential" stories, newest first, each with its hook idea
   - any `explainer` story that would make a good Clear Evidence paper
   - how many sources had stories, and which couldn't be reached

   The user chose not to use Slack, so the page and this reply are where they see it.
   Remind them they can send TikTok Creative Center or Instagram Explore screenshots with
   `/trending` to add what's trending on social.
