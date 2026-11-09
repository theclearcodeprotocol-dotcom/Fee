"""Build edits/clear-evidence-02-soft/index.html: a calmer comparison cut of clear-evidence-01.
Same cut (assets/footage/take01-cut.mp4), same words and story; what changes is the intensity:
  - framing: two gentle crops (1.00 / 1.08) set on cuts only; no whips, blur or emphasis punch
  - captions: smaller, lighter pill, no red keyword chips (keyword just a heavier weight)
  - pop-ups: 9 instead of 16, all flat cream cards or pills, no rotation, no stamps,
    sparkles or giant numbers; every one fades in with a short 14 px drift
  - sound: 4 soft clicks at low volume instead of 16 pops, slams, sparkles and whooshes
Re-run: python3 scripts/build_comp_soft.py"""
import html, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "edits/clear-evidence-02-soft/index.html"
data = json.load(open(ROOT / "assets/footage/take01-cut.words.json"))
W, SEGS = data["words"], data["segments"]
TOTAL = SEGS[-1]["end"]
E = html.escape


def clean(t):
    return re.sub(r"[^\w$']", "", t).lower()


def at(word, after=0.0, which="start"):
    for w in W:
        if w["start"] >= after - 1e-3 and clean(w["text"]) == word:
            return w[which]
    raise KeyError(word)


# ---------------------------------------------------------------- captions (same grouping as 01)
KEYWORDS = [["paywalls"], ["jargon"], ["clear", "evidence"], ["brand", "bias"], ["plain", "english"],
            ["five", "minutes"], ["three"], ["bio"]]
groups, cur = [], []
for i, w in enumerate(W):
    cur.append(w)
    nxt = W[i + 1] if i + 1 < len(W) else None
    end_punct = w["text"][-1] in ".,?!"
    if (nxt is None or nxt["seg"] != w["seg"] or nxt["start"] - w["end"] >= 0.15
            or len(cur) >= 5 or (end_punct and len(cur) >= 2)):
        groups.append(cur); cur = []
merged = []
for g in groups:
    if merged and len(g) == 1 and g[0]["end"] - g[0]["start"] < 0.45 and len(merged[-1]) < 5 \
            and g[0]["seg"] == merged[-1][-1]["seg"]:
        merged[-1] = merged[-1] + g
    else:
        merged.append(g)
groups = merged


def key_span(g):
    toks = [clean(w["text"]) for w in g]
    for kw in KEYWORDS:
        for j in range(len(toks) - len(kw) + 1):
            if toks[j:j + len(kw)] == kw:
                return j, j + len(kw)
    return None


cap_html, cap_js = [], []
for gi, g in enumerate(groups):
    s = max(0.1, g[0]["start"] - 0.05)
    e = g[-1]["end"]
    if gi + 1 < len(groups):
        ns = max(0.1, groups[gi + 1][0]["start"] - 0.05)
        if ns - e < 0.35:
            e = ns
    e = min(e, TOTAL - 0.02)
    span = key_span(g)
    words = [E(w["text"]) for w in g]
    if span:
        words[span[0]] = '<b>' + words[span[0]]
        words[span[1] - 1] = words[span[1] - 1] + '</b>'
    cap_html.append(f'<div class="cap" id="cap{gi}"><span class="pill">{" ".join(words)}</span></div>')
    cap_js.append(f'cap("#cap{gi}", {s:.3f}, {e:.3f});')

# ---------------------------------------------------------------- framing: gentle, on cuts only
WIDE, CLOSE = 1.0, 1.08
changes = [s["start"] for s in SEGS]
# two sentence starts inside the long segments so no framing sits much past ~10 s
for name, after in [("skin", 12.0), ("each", 34.0)]:
    t = at(name, after)
    if all(abs(t - c) > 1.2 for c in changes):
        changes.append(t - 0.04)
changes = sorted(changes)
frame_js = [f'tl.set("#cam", {{ scale: {CLOSE if i % 2 else WIDE} }}, {t:.3f});' for i, t in enumerate(changes)]

# ---------------------------------------------------------------- pop-ups
pops, pop_js, sfx = [], [], []
n = [0]


def pop(start, dur, inner, fade_in=True, sound=None):
    n[0] += 1
    pid = f"p{n[0]}"
    start = max(0.0, start)
    dur = min(dur, TOTAL - start - 0.02)
    pops.append(f'<div id="{pid}" class="clip pop" data-start="{start:.3f}" data-duration="{dur:.3f}" '
                f'data-track-index="{2 + n[0]}" data-track-kind="graphics" data-layout-allow-overlap>{inner}</div>')
    sel = f"#{pid} .in"
    if fade_in:
        pop_js.append(f'tl.fromTo("{sel}", {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "power2.out", immediateRender: false }}, {start:.3f});')
    pop_js.append(f'tl.to("{sel}", {{ opacity: 0, duration: 0.3, ease: "power1.in" }}, {start + dur - 0.32:.3f});')
    if sound:
        sfx.append((start, 0.18))


def headline(main, sub="", cover=False):
    return (f'<div class="in headline{" cover" if cover else ""}"><div class="h-main">{main}</div>'
            + (f'<div class="h-sub">{sub}</div>' if sub else "") + "</div>")


# 1 hook line, on from frame 0
pop(0.0, at("stuck") - 0.05, headline("The research exists."), fade_in=False)
# 2 paywall (simple card)
st = at("stuck")
pop(st - 0.05, at("filled") - st - 0.05, '''<div class="in card">
  <div class="c-label">Dermatology journal</div>
  <div class="c-title">Retinoids &amp; photoageing: a trial</div>
  <div class="c-row"><span class="lock"></span>Purchase article · $39.95</div></div>''', sound=True)
# 3 jargon (merged with "sell": one card covers the rest of the problem line)
fl = at("filled")
pop(fl - 0.05, SEGS[4]["start"] - fl - 0.1, '''<div class="in card">
  <div class="c-label">Medical jargon</div>
  <p data-layout-ignore>…transepidermal water loss was attenuated via upregulation of filaggrin and ceramide
  synthase expression in the stratum corneum…</p></div>''')
# 4/5 cover the source's burned-in title (first ~3.2 s of segment 4)
c0 = SEGS[4]["start"]
ce = at("clear", c0)
pop(c0, ce - c0 - 0.05, headline("Work with skin every day?", cover=True))
pop(ce - 0.05, 2.1, headline("Clear Evidence", "built for skin specialists", cover=True))
# 6 no brand bias (quiet pill)
pop(at("brand") - 0.05, 1.8, '<div class="in tag">Evidence, not brand bias</div>')
# 7 paper card
pl = at("plain")
pop(pl - 0.05, min(at("only") - pl + 0.9, at("five") - pl - 0.1), '''<div class="in card">
  <div class="c-label"><span class="mark">c.</span>Clear Evidence · Monthly paper</div>
  <div class="c-title">Does niacinamide really fade dark spots?</div>
  <div class="c-line">Short answer: yes, at 4–5%.</div></div>''', sound=True)
# 8 what each paper gives you: one list that builds with the speech
fv = at("five")
th = at("three")
pop(fv - 0.05, at("day", th, "end") - fv + 0.6, f'''<div class="in card list">
  <div class="c-label">Every paper</div>
  <div class="row" data-at="{fv:.3f}">5-minute read</div>
  <div class="row" data-at="{at("graded"):.3f}">Graded by strength of evidence</div>
  <div class="row" data-at="{th:.3f}">3 key takeaways for the clinic</div></div>''', sound=True)
# 9 link in bio
lk = at("overwhelm", 44.0) + 0.25
pop(lk - 0.05, TOTAL - lk + 0.03, '<div class="in tag">Link in bio</div>', sound=True)

audio = []
for k, (t, vol) in enumerate(sfx):
    st = max(0.0, t + 0.15 - 0.073)  # click-soft peaks 0.073 s in; land as the card settles
    audio.append(f'<audio id="sfx{k}" class="clip" src="sfx/click-soft.mp3" data-start="{st:.3f}" data-duration="0.366" '
                 f'data-volume="{vol}" data-track-index="{40 + k}"></audio>')

# ---------------------------------------------------------------- page
page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="vendor/gsap-3.15.0.min.js"></script>
<style>
@font-face {{ font-family: "Source Serif 4"; font-weight: 900; font-style: normal; src: url("fonts/source-serif-4-latin-900-normal.woff2") format("woff2"); }}
:root {{ --red:#ae1f14; --cream:#f2f0e0; --pink:#ffd7de; --ink:#5a3a33; --serif:"Source Serif 4", serif; --sans:"Outfit", sans-serif; }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:1080px; height:1920px; overflow:hidden; background:#000; }}
#root {{ position:relative; width:1080px; height:1920px; overflow:hidden; }}
#cam {{ position:absolute; inset:0; transform-origin:50% 36%; will-change:transform; }}
#footage {{ position:absolute; inset:0; width:1080px; height:1920px; object-fit:cover; }}

/* captions: smaller, lighter, no chips */
#captions {{ position:absolute; inset:0; pointer-events:none; }}
.cap {{ position:absolute; left:0; right:0; top:1360px; text-align:center; opacity:0; visibility:hidden; }}
.pill {{ display:inline-block; max-width:860px; background:rgba(242,240,224,.92); color:var(--red); font:500 44px/1.2 var(--sans);
  padding:12px 26px 14px; border-radius:999px; box-shadow:0 4px 12px rgba(0,0,0,.12); }}
.pill b {{ font-weight:700; }}

/* pop-ups: flat, upright, cream */
.pop {{ pointer-events:none; }}
.pop .in {{ position:absolute; left:0; right:0; margin-inline:auto; width:fit-content; top:140px; }}
.pop .in.cover {{ top:262px; min-width:760px; }}  /* over the source's burned-in title (y≈300-345) */
.headline {{ background:var(--cream); color:var(--red); border-radius:18px; padding:18px 34px 22px; text-align:center; white-space:nowrap;
  box-shadow:0 6px 18px rgba(0,0,0,.14); }}
.h-main {{ font:900 60px/1.04 var(--serif); letter-spacing:-0.05em; }}
.h-sub {{ font:500 32px/1.2 var(--sans); color:var(--ink); margin-top:6px; }}
.card {{ background:var(--cream); color:var(--red); border-radius:24px; box-shadow:0 8px 24px rgba(0,0,0,.16);
  padding:28px 34px; width:760px !important; }}
.c-label {{ display:flex; align-items:center; gap:12px; font:600 28px var(--sans); letter-spacing:.06em; text-transform:uppercase; color:var(--ink); opacity:.8; }}
.c-title {{ font:900 42px/1.08 var(--serif); letter-spacing:-0.04em; margin:12px 0 14px; }}
.c-row {{ display:flex; align-items:center; gap:14px; font:500 30px var(--sans); color:var(--red); border-top:2px solid rgba(174,31,20,.18); padding-top:14px; }}
.c-line {{ font:400 30px/1.35 var(--sans); color:var(--ink); }}
.card p {{ font:400 30px/1.4 var(--serif); color:var(--ink); margin-top:10px; }}
.lock {{ width:24px; height:20px; background:var(--red); border-radius:4px; position:relative; margin-top:10px; }}
.lock::before {{ content:""; position:absolute; left:4px; top:-13px; width:16px; height:16px; border:4px solid var(--red);
  border-bottom:none; border-radius:10px 10px 0 0; box-sizing:border-box; }}
.mark {{ display:inline-grid; place-items:center; width:44px; height:44px; border-radius:50%; background:var(--red); color:var(--cream);
  font:900 30px/1 var(--serif); padding-bottom:4px; letter-spacing:0; }}
.list .row {{ font:500 34px/1.3 var(--sans); color:var(--red); padding:12px 0; border-top:2px solid rgba(174,31,20,.15); opacity:0; }}
.list .c-label {{ margin-bottom:6px; }}
.tag {{ background:var(--cream); color:var(--red); font:600 40px var(--sans); border-radius:999px; padding:14px 34px 16px;
  box-shadow:0 6px 18px rgba(0,0,0,.14); white-space:nowrap; }}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL:.3f}" data-width="1080" data-height="1920">
  <div id="cam">
    <video id="footage" class="clip" src="footage/take01-cut.mp4" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="0"
      playsinline data-has-audio="true"></video>
  </div>
  {"".join(pops)}
  <div id="captions" class="clip" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="1" data-track-kind="captions" data-layout-allow-overlap>
    {"".join(cap_html)}
  </div>
  {"".join(audio)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
tl.set("#cam", {{ scale: 1 }}, 0);
function cap(sel, s, e) {{
  tl.set(sel, {{ visibility: "visible" }}, s);
  tl.fromTo(sel, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.15, ease: "power1.out", immediateRender: false }}, s);
  tl.to(sel, {{ opacity: 0, duration: 0.1, ease: "power1.in" }}, e - 0.1);
  tl.set(sel, {{ opacity: 0, visibility: "hidden" }}, e);
}}
{chr(10).join(frame_js)}
{chr(10).join(pop_js)}
document.querySelectorAll("[data-at]").forEach((el) => {{
  tl.fromTo(el, {{ opacity: 0 }}, {{ opacity: 1, duration: 0.35, ease: "power1.out", immediateRender: false }}, parseFloat(el.dataset.at));
}});
{chr(10).join(cap_js)}
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
'''
OUT.write_text(page)
print(f"wrote {OUT.relative_to(ROOT)}: {len(groups)} caption groups, {n[0]} pop-ups, {len(audio)} sfx, "
      f"{len(changes)} framing changes, duration {TOTAL:.3f}s")
