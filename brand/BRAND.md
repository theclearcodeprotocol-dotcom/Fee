# the clear code. — brand rules for video

Source: `brand/the-clear-code-brand-guide.pdf` (by The Brandology Lab). Every composition
in this project follows these rules unless an edit note in `ai-video-editing/` says otherwise.

## Feel
Between professional and playful: feminine, bold, playful. Lower-case, rounded type.
Skincare / acne brand ("bye bye, acne").

## Colours (the only palette)
| Token          | Hex       | Use                                         |
|----------------|-----------|---------------------------------------------|
| `--brand-red`  | `#AE1F14` | Primary. Grounds, headings, logo on light   |
| `--brand-cream`| `#F2F0E0` | Light ground, logo/stickers on red          |
| `--brand-pink` | `#FFD7DE` | Light ground, logo on red                   |
| `--brand-white`| `#FFFFFF` | Accent only                                 |

Pairings used in the guide: pink on red, red on pink, red on cream, cream on red.

## Type
| Role                          | Brand font            | In this project (free/licensed for video)        |
|-------------------------------|-----------------------|--------------------------------------------------|
| Titles, headings, statements  | Source Serif Pro Black| **Source Serif 4, 900** — `assets/fonts/` (OFL)  |
| Body, captions, simplified logo | Dacht Regular       | **Outfit** (bundled with HyperFrames, closest free match) |
| Accent social font            | Times New Roman       | Source Serif 4 900 italic (e.g. "bye bye, acne") |

- Letter spacing **-50** (Canva units) = `letter-spacing: -0.05em` on headings.
- Logos are lower-case and always end with a full stop: `the clear code.`
- Brand fonts in the kit are personal-use licensed only; don't ship the Dacht files here
  unless a commercial/video licence is bought. Swap them in via `@font-face` if so.

## Logo variants
- **Primary**: `the clear code.` one line, serif black.
- **Alternative**: three-line staggered `the / clear / code.` (more playful, bold).
- **Stacked left**: three lines, left aligned.
- **Simplified**: one line in the rounded sans (Dacht → Outfit). Good for end cards and
  the bottom of social posts.
- **Lettermark**: `c.` — use as the watermark / stamp on video.
- **Circular**: "the clear code • the clear code •" on a circle — stamps, watermarks.
- **Stickers**: cream outlined stickers on red — the stacked logo, `c.`, "bye bye, acne",
  cream tube, magnifying glass, sparkles.

When real logo files (PNG/SVG) arrive, put them in `assets/brand/` and use them instead of
typeset versions.
