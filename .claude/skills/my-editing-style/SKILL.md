---
name: my-editing-style
description: The house editing style for the clear code. short-form vertical videos (TikTok, Reels, Shorts). Use for every creative decision when editing the user's talking-head footage - pacing, jump cuts, punch-ins, captions, pop-up graphics, sound effects, music, grade, hook and call to action. Pair with video-use (cutting) and HyperFrames (graphics, captions, render).
---

# My Editing Style — the clear code.

Learned from four reference reels (Loren Hogue x2, Justyn Berkovits x2) and adapted to
the clear code. brand (`brand/BRAND.md`). Base: Loren's calm structure and caption system,
plus Justyn's hook techniques. These are the defaults; the user's notes for a specific
video override them.

## Deliverable

- 1080x1920, 30 fps, H.264 MP4, saved to `exports/`.
- Loudness -14 LUFS integrated, true peak -1 dBTP or lower.
- Length as the user asks; otherwise 35-60 s.

## Tools — who does what

1. **video-use** (`~/.claude/skills/video-use`): Scribe transcript, take selection, EDL,
   per-segment extract with 30 ms audio fades, concat. Follow its Hard Rules. Do **not** burn
   subtitles with video-use; captions are built in HyperFrames.
2. **HyperFrames** (this project): mounts the cut footage as one `<video data-has-audio="true">`,
   adds punch-ins, captions, pop-ups, SFX and optional music, then renders.
3. Always show the plan (takes, hook, graphics map) and wait for the user's OK before cutting.

### Pipeline (proven on clear-evidence-01)

```bash
python helpers/transcribe.py raw/<clip>.mp4 --language en   # video-use, cached in raw/edit/transcripts/
python3 scripts/build_edl.py        # sections + gap removal -> raw/edit/edl.json (edit SECTIONS per video)
~/Developer/video-use/.venv/bin/python scripts/cut_segments.py  # full-res cut -> assets/footage/<clip>-cut.mp4
python3 scripts/retime_words.py     # word timings on the cut's timeline (probed segment lengths)
python3 scripts/build_comp.py       # edits/<name>/index.html: framing, captions, pop-ups, SFX
cd edits/<name> && npx hyperframes check && npx hyperframes snapshot --at ...
npx hyperframes render . -o ../../exports/<name>_render.mp4
python3 scripts/qc_cuts.py exports/<name>_render.mp4 <clip>   # every-cut strips, pop check, loudness
python3 scripts/sync_check.py exports/<name>_render.mp4 <clip>  # lip sync vs the raw source, must say SYNC OK
```

- **Lip sync:** the cut's audio is built as one continuous PCM track, each segment padded or trimmed to
  exactly its video length, then muxed once. Concatenating AAC segments drifted the rendered audio up to
  170 ms behind the lips. Always run `sync_check.py` on the render before delivering.
- Cut at **full source resolution** (video-use's `render.py` downsizes to 1080 wide, which
  softens punch-ins); HyperFrames scales to 1080x1920 at render.
- iPhone footage is often **HDR (HLG)**: tonemap to SDR during the cut (video-use's
  `TONEMAP_CHAIN`).
- Load GSAP from the **local copy** `assets/vendor/gsap-3.15.0.min.js` — the render browser
  can't reach the CDN.
- **Burned-in text** in the source (titles typed in the phone's camera app): scan a 1 fps
  sheet first and cover it with a headline pill placed over it (`.cover`) for as long as it
  shows.
- **Leaning toward the phone** at take ends (to stop recording) or settling at take starts:
  run `python3 scripts/lean_check.py <clip>` (OpenCV 4.x face tracking; flags edges where the face
  grows or shifts >12% vs the take's settled middle). If the lean happens during the last word,
  cover it with a full-screen brand card showing that word (cream ground, red Source Serif 4 Black,
  `c.` mark) from the word's start to the cut — the voice carries on underneath. If it happens after
  the last word, tighten the tail pad instead.
- Place the top-zone pop-ups by the **actual head position**: look at a frame at each
  framing. Pop-ups may overlap hair, never the eyes or mouth.

## 1. Cuts and pacing

- **No dead air.** Remove every pause over ~150 ms, every filler (um, uh, er, "like" used as
  filler, "you know", "so yeah"), every false start and every repeated take. Keep the best
  take of each line: cleanest delivery, most energy, no stumble.
- Cut pads: 40 ms before the first kept word, 60-80 ms after the last (video-use rule 7).
  Never cut inside a word.
- Breaths between sentences go. Keep a natural laugh or reaction if it lands a beat.
- **Something changes on screen every 2-3.5 s** (a cut, a punch-in, a pop-up or a caption
  keyword pop). The first 8 s run faster, every 1-2 s. Never let a frame sit unchanged for
  more than 5 s.

## 2. Punch-ins (one camera)

The user films with one camera, so every framing change is a crop of the same shot.

- Three framings, set on cuts, never tweened during speech:
  - **wide** 1.00x, the base frame
  - **medium** 1.15x
  - **tight** 1.30x, face and shoulders
- Change framing on most jump cuts so the cut reads as intentional. Never use the same
  framing on both sides of a jump cut.
- Anchor the scale on the face (transform-origin about 50% 35%). Keep the eyes in the upper
  third and the face clear of the caption zone.
- Ceiling: 1.30x for 1080p sources. With 4K sources, tight can go to 1.6x.
- **Emphasis punch:** on a payoff word, use one fast 0.15 s push from the current framing
  +0.08x (`power3.out`), held to the next cut. No more than once per 10 s.
- **Whip transition:** at a section change (every 12-20 s, at most 3 per video), use a
  0.25 s whip: directional blur and a 1.25x scale on the footage wrapper across the cut,
  plus a whoosh.

## 3. Captions

On screen for the whole video, one group at a time.

- **Font:** Outfit 700 (bundled with HyperFrames), sentence case, never all caps.
- **Size:** fit each group to max width 860 px; base 54 px, minimum 44 px.
- **Pill:** cream `#F2F0E0` background, border-radius 999 px, padding 14 px 26 px, with a
  soft shadow `0 6px 18px rgba(0,0,0,.18)`.
- **Text colour:** brand red `#AE1F14`.
- **Keyword chip:** one word or number per group at most, usually none. It appears as an
  inline chip with red `#AE1F14` fill, pink `#FFD7DE` text and radius 10 px. Highlight
  numbers, money, names, results and the emotional word ("dead", "cringe", "buyer").
- **Words per group:** 3-5. Break at punctuation, at the original speaker's pause, or at
  5 words.
- **Position:** centred, with the group's centre at y ≈ 1400 (about 73% down). Move it up
  to y ≈ 1250 if it would cover the chin or hands at tight framing. Never cover the face.
- **Timing:** a group opens at its first word's start (minus 0.05 s) and hard-kills at its
  last word's end. In: 0.12 s rise 12 px plus fade (`power2.out`). Out: 0.1 s fade. Never
  start a caption at exactly 0 s: use 0.1 s.
- Build everything on one `data-track-kind="captions"` host (see the hyperframes
  `captions.md` rules: absolute positioning, hard kill after exit).

## 4. Pop-up graphics

Mock-ups are built in HTML/CSS. **No memes, film clips or stock footage** (copyright).
Each pop-up illustrates the exact words being said, appears on the word, and stays
1.5-3 s.

**Density:** one pop-up every 4-7 s. Two in the first 3 s. Never two new elements in the
same 0.5 s.

**Placement zones** (keep the face clear):
- **Top zone:** y 180-620. Use for headline pills, big numbers and stamps.
- **Mid-side zone:** a card at x 600-1020 or x 60-480, y 700-1150, beside the head and never
  over it.
- **Series tag:** y 110.

| Pop-up | Use when | Look | In / out |
|---|---|---|---|
| **Headline pill** | The hook line or a key claim restated | Source Serif 4 Black, -0.05em letter spacing, 60-72 px, cream text on a red `#AE1F14` pill (radius 18 px). An optional second line in Outfit 600, 34 px, pink | Scale 0.9 to 1 with `back.out(2)` over 0.3 s; fade out 0.2 s |
| **Big number / keyword** | Numbers, money, counts ("$100", "200 videos") | Source Serif 4 Black, 170-220 px, red `#AE1F14` fill with a 10 px cream outline (`paint-order: stroke`), rotated -3°. Brand sticker style | Pop 0.6 to 1.05 to 1 over 0.35 s, plus a pop SFX |
| **Italic accent word** | An emotional or ironic word ("glamorous", "can't") | Source Serif 4 Black Italic, 110-140 px, pink `#FFD7DE` with soft shadow, and 2-3 cream 4-point sparkles (✦ shape) around it | Fade and drift up 20 px; sparkles twinkle; sparkle SFX |
| **Stamp** | A verdict ("CRINGE", "WRONG", "NO") | Outfit 800 caps, 90 px, red text, 8 px red border, transparent fill, rotated -8°, slight rough edge (mask) | Slam from 1.6x to 1x over 0.12 s, plus impact-bass SFX at -6 dB |
| **Screenshot / UI mock-up card** | Talking about a profile, stats, an app, a message, a result | Cream card, radius 28 px, 8 px cream border, shadow `0 18px 40px rgba(0,0,0,.28)`, rotated ±2°. Contents rebuilt in HTML (stats, list rows, chat bubble), circling or underlining the key number in red | Rise 40 px and fade over 0.35 s; on a highlight, a red circle draws around the number (0.4 s stroke) |
| **List card** | "3 things", steps, a team or tool list | Cream card with a red header pill and 2-6 rows that reveal one by one, 0.25 s apart | Rows from left, staggered |
| **Series tag** (optional) | When the user runs a series | Small pill at the top: red fill, pink Outfit 600, 24 px caps, 0.08em tracking, e.g. `THE CLEAR CODE. · VIDEO 3/100`. On for the whole video | Fade in at 0.1 s |
| **c. watermark** (optional) | Branded posts | The `c.` lettermark, 64 px, cream at 70% opacity, bottom-right at x 960 y 1720 | Static |

## 5. Hook (first 3 seconds)

Pick the strongest line in the whole recording for the open, even if it was said later:
a surprising claim, a number, a confession or a challenge. It must make sense without
context.

- **Frame 0 is never empty:** the headline pill restating the hook is on screen from
  0.0 s, and the first caption appears at 0.1 s.
- **By 0.5 s:** the first pop-up (proof) lands: a stat card, a big number or a screenshot,
  with a pop SFX.
- **By 1.5-2 s:** the first cut, with a framing change.
- **By 2.5-3 s:** the headline swaps or clears and the story starts.
- If the best hook line was moved, cut back to chronological order after it (open loop).

## 6. Sound

- **Voice is king.** Measured, never assumed: mix to -14 LUFS and true peak -1 dBTP or
  lower, then check with `npx hyperframes audio <video> --json`. Say in the delivery note
  that levels were measured, not heard.
- **Music:** none by default. When the user supplies a track, put it in `assets/music/` and
  play it under the voice at about volume 0.14 (roughly -15 dB). Start on a strong bar, duck
  -3 dB more under the hook line, and fade 0.8 s at the end.
- **SFX kit** (`assets/sfx/`, Pixabay licence, commercial use OK; see `CREDITS.md`):

  | Visual event | Sound | Volume |
  |---|---|---|
  | Pop-up, big number or keyword chip landing | `pop.mp3` | 0.35 |
  | Whip transition or a large card sliding | `whoosh.mp3` / `whoosh-short.mp3`, alternating | 0.4 |
  | Stamp slam | `impact-bass-1.mp3` | 0.3 |
  | Italic accent with sparkles | `sparkle.mp3` | 0.25 |
  | UI mock-up tap | `click.mp3` / `click-soft.mp3`, alternating | 0.35 |
  | Text typed into a mock-up | `typing.mp3` or one `key-press.mp3` per character | 0.25 |

- Every effect needs a cause on screen. At most one effect per 2.5 s, and 6-12 in a
  60 s video. Rotate takes of a repeated sound.
- Land each hit one frame after its picture. `pop.mp3` peaks 0.12 s into the file, so
  start it 0.09 s before the pop-up lands. Measure the others with
  `npx hyperframes audio assets/sfx/<file> --json` (`moments.peak`).

## 7. Grade and look

Warm, soft and flattering, to suit the red, pink and cream brand.

- Start from `eq=contrast=1.04:saturation=1.05:gamma=1.02,colorbalance=rm=0.03:bm=-0.03:rh=0.02:bh=-0.02`
  and look at a frame of skin before and after with `timeline_view.py`. Adjust one thing at a
  time; skin must never go orange or grey.
- Apply it per segment during video-use extraction, never after concat.

## 8. Call to action (optional, only when the user asks)

Keep this ready but don't add it by default.

- **Comment-box mock-up**, last 3-4 s: a cream comment field ("Add a comment…") slides up
  in the top zone; the keyword types in letter by letter (key-press per letter); "Post"
  turns red and clicks. Then a reply bubble pops in from the clear code. (`c.` lettermark
  avatar): "sent ✓".
- Spoken line on screen as captions as usual; the keyword gets the red chip.
- Optional end tag below: Source Serif 4 Black, 64 px, `the clear code.`

## 9. Self-check before showing the user

Run all of video-use's self-eval, plus:

- `sync_check.py` on the render says SYNC OK (every offset within one frame, 33 ms).
- `npm run check` passes, and `npx hyperframes snapshot` at every cut ±0.2 s, at each
  pop-up's landing frame, and at 0, 1, 2 and 3 s.
- At every cut: no visual jump that looks like a mistake (a framing change must happen),
  no audio pop (waveform spike), no caption or pop-up covering the eyes or mouth.
- Captions fully inside the frame and readable at phone size.
- Cap at 3 fix-and-recheck passes, then report what's left.
- Tell the user the file name in `exports/`, the length, the loudness numbers, and which
  takes and hook were used.
