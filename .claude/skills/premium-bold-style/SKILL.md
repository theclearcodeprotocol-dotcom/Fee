---
name: premium-bold-style
description: The "premium bold" look for the clear code. talking-head reels - editorial serif type, deep-red and cream hairline panels that mask-wipe in, pill-free captions over a scrim, slow camera push inside every shot, red curtain wipes and a c. seal. Use when the user asks for the premium style, premium bold, "like the premium one", or a more premium/luxury/editorial look. Layers on top of my-editing-style (pacing, cuts, hook rules still apply); this skill replaces its look - captions, pop-up styling, punch-in motion, transitions and sound.
---

# Premium Bold — the clear code.

Approved by the user on the Clear Evidence reel (`edits/clear-evidence-03-premium-bold`,
export `exports/clear-evidence-03-premium-bold_phone.mp4`). Reference implementation:
`scripts/build_comp_premium.py bold` — start every new premium video from a copy of it.

Feel: a magazine cover that talks. Every beat of the bold edit is kept (one graphic every
4-7 s), but each is set like editorial print: restrained colour, tracked small caps, serif
display, fine rules, slow confident motion. Nothing bounces, tilts, or slams.

## What stays from my-editing-style

Cuts and pacing, the hook rules, pop-up density and placement zones (top zone, face clear),
burned-in-text covering, deliverable spec (1080x1920, 30 fps, -14 LUFS, TP <= -1 dBTP).
Everything below replaces that skill's look.

## Tokens

```css
--red:#ae1f14; --deep:#8a170f; --cream:#f2f0e0; --pink:#ffd7de; --ink:#5a3a33;
--serif:"Source Serif 4"; --sans:"Outfit";
--hair:rgba(242,240,224,.55);      /* hairline on red */
--hair-red:rgba(174,31,20,.28);    /* hairline on cream */
```

Load Source Serif 4 900 normal **and italic** via `@font-face` from `fonts/`. Outfit is bundled.

## Type system

| Role | Spec |
|---|---|
| Eyebrow (label above every panel/card) | Outfit 600, 28 px, uppercase, letter-spacing .22em. Pink on red; ink on cream with a 1.5 px `--hair-red` rule under it. Keep it 1-3 words so it never wraps |
| Panel title | Source Serif 4 900, 70 px (64 px on cover panels, 58 px on slim panels), -0.05em |
| Panel sub | Source Serif 4 900 *italic*, 34 px, pink |
| Card title | Source Serif 4 900, 46 px, -0.045em, red |
| Card body / rows | Outfit 500, 30-34 px; list numerals as italic serif `i. ii. iii.` in ink |
| Accent word | Source Serif 4 900 italic, 128 px, red, `text-shadow:0 0 30px rgba(242,240,224,.65)`, with a drawn rule (underline, or strike-through for a word being rejected) |
| Numeral | Source Serif 4 900 italic, 240 px, red, plus a tracked Outfit 600 unit label ("MINUTE READ") |
| Caption | Outfit 500, 50 px, cream, `text-shadow:0 2px 3px rgba(0,0,0,.35), 0 6px 24px rgba(0,0,0,.35)`; keyword as Source Serif 900 italic 56 px pink. **No pill** |

Minimum reading size 28 px everywhere.

## Components

All pop-ups are full-frame `.clip` hosts with one positioned `.in` child at `top:170px`
(centred, `width:fit-content`). Set fixed widths with `.pop .in.card {width:800px}` —
plain `.card` loses to `.pop .in` specificity.

- **Panel** — red ground, cream type, radius 6 px, padding 30/56/36, shadow
  `0 18px 50px rgba(40,6,4,.28)`, inner hairline: `::after { inset:10px; border:1.5px solid var(--hair) }`.
  Eyebrow + title (+ italic sub). Use for the hook line, claims, intros, CTA ("JOIN THE MEMBERS / Link in bio").
- **Cover panel** — a panel at `top:236px`, **fixed width 940 px**, opaque, for hiding text
  burned into the source. When one cover replaces another, keep the first on screen (no
  fade-out) until the second's wipe completes (~0.5 s), and give both the same width.
- **Card** — cream ground, red type, same radius/shadow, hairline in `--hair-red`, 800 px wide.
  Eyebrow + content: UI mock-ups (paywall with italic price), quoted jargon (key term in
  italic red with underline), lists that build row by row, journal lists, a 3-step grade bar
  (tracked caps cells, the active one fills red on its word).
- **Accent word** — big italic serif word with a rule that draws in. Strike-through for the
  thing being dismissed ("sales pitch"), underline for the promise ("no brand bias", "trust").
- **Numeral** — giant italic number + tracked unit, for counts and times ("5 / MINUTE READ").
- **Seal** — the `c.` lettermark in a 76 px red circle with an inner cream hairline ring,
  bottom-right (right 56 px, top 1758 px), on for the whole video.
- **Scrim** — bottom 900 px gradient, transparent -> `rgba(20,8,6,.5)`, under the captions for
  legibility. It is a graphic overlay, not a grade.
- **Curtain** — full-frame red panel with a 200 px cream `c.` (`data-layout-ignore`), for
  section changes (max 2-3 per video).

## Motion (all seek-safe GSAP on one paused timeline)

- **Mask wipe in** (panels, cards): `.in` clip-path `inset(0 100% 0 0)` -> `inset(0 0 0 0)`,
  0.55 s `expo.out`; then its direct `.tx` children (excluding rows with `data-at`) rise
  18 px + fade, 0.6 s `expo.out`, stagger 0.07, starting +0.12 s.
- **Rise in** (accent words, numerals, a second cover): opacity 0 -> 1, y 26 -> 0, 0.7 s
  `expo.out`; the rule draws `scaleX 0 -> 1`, 0.5 s `expo.inOut`, +0.25 s.
- **Out**: opacity -> 0, y -10, 0.35 s `power2.in`, ending at the clip's end.
- **Staged rows**: each row fades in from x -16 at its spoken word (`data-at`), 0.5 s `expo.out`.
- **Camera**: framing set on cuts from the cycle `1.00, 1.10, 1.18, 1.10, 1.00, 1.18` (never
  the same on both sides of a cut), then a linear push to `scale * 1.025` over the length of
  each shot. Transform origin `50% 36%`. No whips, no blur, no emphasis punches.
- **Curtain**: red panel slides in from the left over 0.3 s `power3.in` ending on the cut,
  then out to the right over 0.34 s `power3.out`.
- **Captions**: one group at a time, 3-5 words; fade + 8 px rise 0.2 s in, 0.08 s out (skip
  the fade-out on groups under 0.32 s), hard-hidden at the end.

## Sound

Restrained. `click-soft.mp3` at 0.2 as each card's wipe lands (peak 0.073 s into the file:
start it so the peak hits ~0.2 s after the wipe begins). `whoosh-short.mp3` at 0.18 on accent
words and numerals. `whoosh.mp3` / `whoosh-short.mp3` at 0.25 on the curtains. No pops,
impacts or sparkles. ~10-12 effects in 50 s.

Loudness: renders come out around -16.5 LUFS, so the phone export uses **two-pass**
`loudnorm=I=-14:TP=-1.5:LRA=11` (measure, then apply with `linear=true`); single-pass lands
about 1 LU low. Verify with `ebur128=peak=true` and report the measured numbers.

## Build a new premium bold video

1. Cut as usual (my-editing-style pipeline): EDL, `scripts/cut_segments.py <clip>`,
   `scripts/retime_words.py`, giving `assets/footage/<clip>-cut.mp4` and `<clip>-cut.words.json`.
2. Copy `scripts/build_comp_premium.py` to a new script for the video. Change `data`, `OUT`,
   the footage `src`, and `KEYWORDS`; rewrite the pop-up block (the `pop(...)` calls) for the
   new script's beats using the components above, timing each with `at("word")`.
3. Make `edits/<name>/` with symlinks `fonts sfx vendor footage -> ../../assets/...`,
   `hyperframes.json` and `meta.json`.
4. `npx hyperframes check` (the `nested_structure` warnings are expected for this flat
   layout), then `snapshot` at every cover, curtain, card landing and a few caption frames.
   Look for: cards at the set width with nothing clipped, eyebrows on one line, no
   burned-in source text showing around or between covers, face and eyes clear.
5. Render, two-pass loudnorm phone export to `exports/<name>_phone.mp4`, report length and
   measured loudness.
