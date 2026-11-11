"""Premium soft cut of the launch reel (step 2 of 3), same cut as edits/launch-step2.
Look: .claude/skills/premium-bold-style, soft intensity (fewer beats, gentle crops, fewer sounds).
python3 scripts/build_comp_launch_premium.py"""
import html, json, re, sys
from pathlib import Path

BOLD = False
ROOT = Path(__file__).resolve().parent.parent
NAME = "launch-step2-premium-soft"
OUT = ROOT / "edits" / NAME / "index.html"
data = json.load(open(ROOT / "assets/footage/launch-step2-cut.words.json"))
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


# ---------------------------------------------------------------- captions
KEYWORDS = [["plan"], ["cost"], ["launch"], ["name"], ["first"], ["nurture"], ["bio"]]
SPELL = {"program": "programme", "wait": "waitlist"}
CW = []
for w in W:
    w = dict(w)
    k = clean(w["text"])
    if k in SPELL:
        w["text"] = re.sub(k, SPELL[k], w["text"], flags=re.I)
    if k == "list" and CW and clean(CW[-1]["text"]) == "waitlist":
        CW[-1]["end"] = w["end"]; continue
    CW.append(w)
groups, cur = [], []
for i, w in enumerate(CW):
    cur.append(w)
    nxt = CW[i + 1] if i + 1 < len(CW) else None
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
    words[0] = words[0][:1].upper() + words[0][1:]
    if span:
        words[span[0]] = '<em>' + words[span[0]]
        words[span[1] - 1] = words[span[1] - 1] + '</em>'
    cap_html.append(f'<div class="cap" id="cap{gi}"><span class="ct">{" ".join(words)}</span></div>')
    cap_js.append(f'cap("#cap{gi}", {s:.3f}, {min(e, s + 30):.3f});')

# ---------------------------------------------------------------- framing: set on cuts, slow push inside
changes = [s["start"] for s in SEGS]
inner = [("sounds", 0.0), ("where", 7.5)]
for name, after in inner:
    try:
        t = at(name, after)
        if all(abs(t - c) > 1.2 for c in changes):
            changes.append(t - 0.04)
    except KeyError:
        pass
changes = sorted(changes)
cycle = [1.0, 1.1, 1.18, 1.1, 1.0, 1.18] if BOLD else [1.0, 1.06]
frame_js = []
prev = None
for i, t in enumerate(changes):
    sc = cycle[i % len(cycle)]
    if prev is not None and abs(sc - prev) < 1e-6:
        sc = cycle[(i + 1) % len(cycle)]
    prev = sc
    nxt = changes[i + 1] if i + 1 < len(changes) else TOTAL
    frame_js.append(f'shot({t:.3f}, {nxt:.3f}, {sc});')

# ---------------------------------------------------------------- pop-ups
pops, pop_js, sfx = [], [], []
n = [0]


def pop(start, dur, inner_html, reveal="wipe", sound=None, vol=0.2, fade_out=True):
    """reveal: wipe (mask from left), rise (fade + 24px), none (on from frame 0)"""
    n[0] += 1
    pid = f"p{n[0]}"
    start = max(0.0, start)
    dur = min(dur, TOTAL - start - 0.02)
    pops.append(f'<div id="{pid}" class="clip pop" data-start="{start:.3f}" data-duration="{dur:.3f}" '
                f'data-track-index="{3 + n[0]}" data-track-kind="graphics" data-layout-allow-overlap>{inner_html}</div>')
    sel = f"#{pid} .in"
    if reveal == "wipe":
        pop_js.append(f'wipe("#{pid}", {start:.3f});')
    elif reveal == "rise":
        pop_js.append(f'rise("#{pid}", {start:.3f});')
    if fade_out:
        pop_js.append(f'tl.to("{sel}", {{ opacity: 0, y: -10, duration: 0.35, ease: "power2.in" }}, {start + dur - 0.37:.3f});')
    if sound:
        sfx.append((sound, start, vol))


def panel(eyebrow, main, sub="", cls=""):
    return (f'<div class="in panel {cls}"><div class="tx eyebrow">{eyebrow}</div><div class="tx p-main">{main}</div>'
            + (f'<div class="tx p-sub">{sub}</div>' if sub else "") + "</div>")


def card(eyebrow, body, cls=""):
    return f'<div class="in card {cls}"><div class="tx eyebrow">{eyebrow}</div>{body}</div>'


def word(text, rule="under"):
    return f'<div class="in word"><span class="tx w">{text}</span><span class="rule {rule}"></span></div>'


wh, st, la = at("whereas"), at("step"), at("launch")
ex, xi, th, dr = at("explain"), at("existing"), at("three"), at("doors")
pop(0.0, wh - 0.05, panel("Step two", "A name sounds like a plan.", cls="slim"), reveal="none")
pop(wh - 0.05, SEGS[2]["start"] - wh, card("The alternative", '''<div class="tx c-title">A course of treatments</div>
  <div class="tx c-line">…just sounds like a cost.</div>'''), sound="click-soft", vol=0.15)
pop(st - 0.05, SEGS[4]["start"] - st, card("The clear code protocol", f'''
  <div class="tx row" data-at="{st + 0.2:.3f}"><i>i.</i>Plan</div>
  <div class="tx row" data-at="{la - 0.05:.3f}"><i>ii.</i><b>Launch</b></div>
  <div class="tx row" data-at="{la + 0.35:.3f}"><i>iii.</i>Nurture</div>'''))
pop(ex - 0.05, SEGS[8]["start"] - ex + 0.4, card("In one sentence", f'''
  <div class="tx row" data-at="{at('who'):.3f}"><i>i.</i>Who it's for</div>
  <div class="tx row" data-at="{at('how'):.3f}"><i>ii.</i>How long it runs</div>
  <div class="tx row" data-at="{at('what', 16.0):.3f}"><i>iii.</i>What changes along the way</div>'''), sound="click-soft", vol=0.15)
pop(xi - 0.05, SEGS[10]["start"] - xi, panel("Launch to", "Existing clients first.", cls="slim"), reveal="rise")
# eye contact: eyes drop from the end of "clients" (27.75 s) to the end, so a full-frame end page covers it
EP = 27.72
pop(th - 0.05, EP - th + 0.05, panel("Step three", "Nurture keeps them.", cls="slim"), reveal="rise", fade_out=False)
endpage = (f'<div id="endp" class="clip" data-start="{EP:.3f}" data-duration="{TOTAL - EP:.3f}" data-track-index="30" '
           f'data-track-kind="graphics" data-layout-allow-overlap><div class="ep">'
           f'<div class="ep-b"><div class="eyebrow">Black Friday · 27 November</div><div class="ep-title">Doors open.</div>'
           f'<div class="ep-sub">join the waitlist, link in bio</div></div>'
           f'<div class="ep-mark" data-layout-ignore>c.</div></div></div>')
pop_js.append(f'endPage({EP:.3f}, 0);')
sfx.append(("click-soft", EP, 0.15))

# red curtain wipes at the two section changes (bold only)
curtains = []
if BOLD:
    for k, t in enumerate([SEGS[4]["start"], SEGS[7]["start"]]):
        curtains.append(f'<div id="cur{k}" class="clip curtain" data-start="{t - 0.32:.3f}" data-duration="0.66" '
                        f'data-track-index="{30 + k}" data-track-kind="graphics" data-layout-allow-overlap>'
                        f'<div class="cv"><span class="cv-mark" data-layout-ignore>c.</span></div></div>')
        pop_js.append(f'curtain("#cur{k}", {t:.3f});')
        sfx.append(("whoosh" if k == 0 else "whoosh-short", t - 0.3, 0.25))

PEAK = {"click-soft": 0.073, "whoosh": 0.162, "whoosh-short": 0.162}
DUR = {"click-soft": 0.366, "whoosh": 0.57, "whoosh-short": 0.57}
audio = []
for k, (name, t, vol) in enumerate(sfx):
    land = t + (0.2 if name == "click-soft" else 0.0)  # clicks land as a wipe finishes
    s0 = max(0.0, land + 1 / 30 - PEAK[name])
    audio.append(f'<audio id="sfx{k}" class="clip" src="sfx/{name}.mp3" data-start="{s0:.3f}" '
                 f'data-duration="{min(DUR[name], TOTAL - s0 - 0.01):.3f}" data-volume="{vol}" data-track-index="{40 + k}"></audio>')

# ---------------------------------------------------------------- page
page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="vendor/gsap-3.15.0.min.js"></script>
<style>
@font-face {{ font-family: "Source Serif 4"; font-weight: 900; font-style: normal; src: url("fonts/source-serif-4-latin-900-normal.woff2") format("woff2"); }}
@font-face {{ font-family: "Source Serif 4"; font-weight: 900; font-style: italic; src: url("fonts/source-serif-4-latin-900-italic.woff2") format("woff2"); }}
:root {{ --red:#ae1f14; --deep:#8a170f; --cream:#f2f0e0; --pink:#ffd7de; --ink:#5a3a33;
  --serif:"Source Serif 4", serif; --sans:"Outfit", sans-serif; --hair:rgba(242,240,224,.55); --hair-red:rgba(174,31,20,.28); }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:1080px; height:1920px; overflow:hidden; background:#000; }}
#root {{ position:relative; width:1080px; height:1920px; overflow:hidden; }}
#cam {{ position:absolute; inset:0; transform-origin:50% 36%; will-change:transform; }}
#footage {{ position:absolute; inset:0; width:1080px; height:1920px; object-fit:cover; }}

/* bottom scrim for caption legibility */
#scrim {{ position:absolute; left:0; right:0; bottom:0; height:900px; pointer-events:none;
  background:linear-gradient(to bottom, rgba(20,8,6,0) 0%, rgba(20,8,6,.18) 45%, rgba(20,8,6,.5) 100%); }}

/* captions: no pill, editorial */
#captions {{ position:absolute; inset:0; pointer-events:none; }}
.cap {{ position:absolute; left:90px; right:90px; top:1380px; text-align:center; opacity:0; visibility:hidden; }}
.ct {{ font:500 50px/1.22 var(--sans); color:var(--cream); letter-spacing:-0.005em;
  text-shadow:0 2px 3px rgba(0,0,0,.35), 0 6px 24px rgba(0,0,0,.35); }}
.ct em {{ font:italic 900 56px/1 var(--serif); color:var(--pink); letter-spacing:-0.03em; }}

/* lettermark seal */
#seal {{ position:absolute; right:56px; top:1758px; width:76px; height:76px; border-radius:50%; background:var(--red);
  display:grid; place-items:center; box-shadow:0 6px 18px rgba(0,0,0,.22); }}
#seal::after {{ content:""; position:absolute; inset:5px; border-radius:50%; border:1.5px solid var(--hair); }}
#seal span {{ font:900 44px/1 var(--serif); color:var(--cream); letter-spacing:-0.05em; padding-bottom:6px; }}

/* pop-ups */
.pop {{ pointer-events:none; }}
.pop .in {{ position:absolute; left:0; right:0; margin-inline:auto; width:fit-content; top:170px; }}
.eyebrow {{ display:flex; align-items:center; justify-content:center; gap:12px; font:600 28px/1 var(--sans);
  letter-spacing:.22em; text-transform:uppercase; }}
.panel {{ background:var(--red); color:var(--cream); border-radius:6px; padding:30px 56px 36px; text-align:center;
  box-shadow:0 18px 50px rgba(40,6,4,.28); white-space:nowrap; }}
.panel::after, .card::after {{ content:""; position:absolute; inset:10px; border-radius:2px; border:1.5px solid var(--hair); pointer-events:none; }}
.panel .eyebrow {{ color:var(--pink); }}
.p-main {{ font:900 70px/1.02 var(--serif); letter-spacing:-0.05em; margin-top:14px; }}
.p-sub {{ font:italic 900 34px/1.2 var(--serif); color:var(--pink); letter-spacing:-0.02em; margin-top:10px; }}
.pop .in.panel.cover {{ top:236px; width:940px; padding-inline:30px; }}
.panel.cover .p-main {{ font-size:64px; }}  /* over the source's burned-in title (y≈300-345) */
.panel.slim .p-main {{ font-size:58px; }}
.pop .in.card {{ width:800px; }}
.card {{ background:var(--cream); color:var(--red); border-radius:6px; padding:34px 44px 38px;
  box-shadow:0 18px 50px rgba(40,6,4,.24); }}
.card::after {{ border-color:var(--hair-red); }}
.card .eyebrow {{ justify-content:flex-start; color:var(--ink); padding-bottom:18px; border-bottom:1.5px solid var(--hair-red); }}
.c-title {{ font:900 46px/1.08 var(--serif); letter-spacing:-0.045em; margin:20px 0 16px; }}
.c-row {{ display:flex; align-items:center; gap:14px; font:500 30px var(--sans); color:var(--ink); }}
.c-row .price {{ margin-left:auto; font:italic 900 40px var(--serif); color:var(--red); letter-spacing:-0.03em; }}
.c-line {{ font:italic 900 32px/1.3 var(--serif); color:var(--ink); letter-spacing:-0.02em; }}
.card p {{ font:400 31px/1.42 var(--serif); color:var(--ink); margin-top:20px; }}
.card mark {{ background:none; color:var(--red); font-style:italic; font-weight:900; border-bottom:2px solid var(--red); }}
.lock {{ width:24px; height:20px; background:var(--red); border-radius:4px; position:relative; margin-top:10px; }}
.lock::before {{ content:""; position:absolute; left:4px; top:-13px; width:16px; height:16px; border:4px solid var(--red);
  border-bottom:none; border-radius:10px 10px 0 0; box-sizing:border-box; }}
.mark {{ display:inline-grid; place-items:center; width:44px; height:44px; border-radius:50%; background:var(--red); color:var(--cream);
  font:900 30px/1 var(--serif); letter-spacing:-0.05em; padding-bottom:4px; }}
.row {{ font:500 34px/1.3 var(--sans); color:var(--red); padding:16px 0 14px; border-bottom:1.5px solid var(--hair-red); opacity:0; }}
.row:last-child {{ border-bottom:none; }}
.row b {{ font-weight:700; }}
.row i {{ display:inline-block; width:64px; font:italic 900 34px var(--serif); color:var(--ink); }}
.pair {{ display:flex; align-items:center; justify-content:center; gap:30px; margin-top:22px; }}
.pair .tx {{ font:italic 900 72px/1 var(--serif); letter-spacing:-0.04em; opacity:0; }}
.dash {{ width:90px; height:2px; background:var(--red); }}
.jrow {{ font:900 34px/1.2 var(--serif); letter-spacing:-0.03em; padding:16px 0 14px; border-bottom:1.5px solid var(--hair-red); }}
.jrow:last-child {{ border-bottom:none; }}
.bars {{ display:flex; gap:14px; margin-top:24px; }}
.g {{ flex:1; text-align:center; font:600 28px var(--sans); letter-spacing:.12em; text-transform:uppercase; padding:20px 0;
  border:1.5px solid var(--hair-red); color:rgba(174,31,20,.55); border-radius:3px; }}
.g.on.lit {{ background:var(--red); color:var(--cream); border-color:var(--red); }}
.word {{ top:230px; text-align:center; white-space:nowrap; }}
.w {{ display:block; font:italic 900 128px/1 var(--serif); color:var(--red); letter-spacing:-0.045em;
  text-shadow:0 0 30px rgba(242,240,224,.65); }}
.rule {{ position:absolute; height:5px; background:var(--red); left:-10px; right:-10px; transform-origin:0 50%; }}
.rule.under {{ bottom:-22px; height:3px; left:20%; right:20%; }}
.rule.strike {{ top:58%; }}
.numeral {{ top:180px; display:flex; align-items:flex-end; gap:22px; }}
.n {{ font:italic 900 240px/0.8 var(--serif); color:var(--red); letter-spacing:-0.06em; text-shadow:0 0 30px rgba(242,240,224,.65); }}
.n-unit {{ font:600 30px/1 var(--sans); letter-spacing:.22em; text-transform:uppercase; color:var(--red); padding-bottom:14px;
  text-shadow:0 0 18px rgba(242,240,224,.9); }}
.curtain {{ pointer-events:none; }}
#endp {{ pointer-events:none; }}
.ep {{ position:absolute; inset:0; background:var(--red); color:var(--cream); }}
.ep::after {{ content:""; position:absolute; inset:28px; border:1.5px solid var(--hair); border-radius:4px; }}
.ep-b {{ position:absolute; left:0; right:0; top:700px; text-align:center; }}
.ep .eyebrow {{ color:var(--pink); }}
.ep-title {{ font:900 124px/0.98 var(--serif); letter-spacing:-0.05em; margin-top:30px; }}
.ep-sub {{ font:italic 900 52px/1.2 var(--serif); color:var(--pink); letter-spacing:-0.02em; margin-top:26px; }}
.ep-mark {{ position:absolute; left:0; right:0; top:420px; text-align:center; font:900 120px/1 var(--serif); letter-spacing:-0.05em; color:var(--cream); opacity:.9; }}
.cv {{ position:absolute; inset:0; background:var(--red); display:grid; place-items:center; }}
.cv-mark {{ font:900 200px/1 var(--serif); color:var(--cream); letter-spacing:-0.05em; }}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL:.3f}" data-width="1080" data-height="1920">
  <div id="cam">
    <video id="footage" class="clip" src="footage/launch-step2-cut-eyes.mp4" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="0"
      playsinline data-has-audio="true"></video>
  </div>
  <div id="scrim" class="clip" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="1" data-track-kind="graphics" data-layout-allow-overlap></div>
  {"".join(pops)}
  {endpage}
  <div id="captions" class="clip" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="2" data-track-kind="captions" data-layout-allow-overlap>
    {"".join(cap_html)}
  </div>
  <div id="seal" class="clip" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="3" data-track-kind="graphics"><span>c.</span></div>
  {"".join(curtains)}
  {"".join(audio)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
tl.set("#cam", {{ scale: 1 }}, 0);
function shot(a, b, sc) {{  // framing set on the cut, then a slow push for the length of the shot
  tl.fromTo("#cam", {{ scale: sc }}, {{ scale: sc * 1.025, duration: Math.max(0.05, b - a - 0.001), ease: "none", immediateRender: false }}, a);
}}
function wipe(host, t) {{
  const box = host + " .in";
  tl.fromTo(box, {{ clipPath: "inset(0% 100% 0% 0%)" }}, {{ clipPath: "inset(0% 0% 0% 0%)", duration: 0.55, ease: "expo.out", immediateRender: false }}, t);
  const txt = document.querySelectorAll(host + " .in > .tx:not([data-at])");
  if (txt.length) tl.fromTo(txt, {{ opacity: 0, y: 18 }}, {{ opacity: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.07, immediateRender: false }}, t + 0.12);
}}
function rise(host, t) {{
  tl.fromTo(host + " .in", {{ opacity: 0, y: 26 }}, {{ opacity: 1, y: 0, duration: 0.7, ease: "expo.out", immediateRender: false }}, t);
  const rule = document.querySelector(host + " .rule");
  if (rule) tl.fromTo(rule, {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.5, ease: "expo.inOut", immediateRender: false }}, t + 0.25);
}}
function curtain(host, t) {{
  tl.fromTo(host + " .cv", {{ x: -1080 }}, {{ x: 0, duration: 0.3, ease: "power3.in", immediateRender: false }}, t - 0.3);
  tl.to(host + " .cv", {{ x: 1080, duration: 0.34, ease: "power3.out" }}, t);
}}
function endPage(t, swap) {{  // red page wipes in from the left, then its line changes on "our doors"
  tl.fromTo("#endp .ep", {{ clipPath: "inset(0% 100% 0% 0%)" }}, {{ clipPath: "inset(0% 0% 0% 0%)", duration: 0.45, ease: "expo.out", immediateRender: false }}, t);
  tl.fromTo("#endp .ep-b > *", {{ opacity: 0, y: 18 }}, {{ opacity: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.12, immediateRender: false }}, t + 0.15);
}}
function cap(sel, s, e) {{
  tl.set(sel, {{ visibility: "visible" }}, s);
  tl.fromTo(sel, {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.2, ease: "power2.out", immediateRender: false }}, s);
  if (e - s > 0.32) tl.to(sel, {{ opacity: 0, duration: 0.08, ease: "power1.in" }}, e - 0.08);
  tl.set(sel, {{ opacity: 0, visibility: "hidden" }}, e);
}}
{chr(10).join(frame_js)}
{chr(10).join(pop_js)}
document.querySelectorAll("[data-at]").forEach((el) => {{
  const t = parseFloat(el.dataset.at);
  if (el.classList.contains("g")) tl.set(el, {{ className: "g on lit" }}, t);
  else tl.fromTo(el, {{ opacity: 0, x: -16 }}, {{ opacity: 1, x: 0, duration: 0.5, ease: "expo.out", immediateRender: false }}, t);
}});
{chr(10).join(cap_js)}
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
'''
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(page)
print(f"wrote {OUT.relative_to(ROOT)}: {len(groups)} caption groups, {n[0]} pop-ups, {len(audio)} sfx, "
      f"{len(changes)} framings, duration {TOTAL:.3f}s")
