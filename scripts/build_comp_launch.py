"""Build edits/launch-step2/index.html from the cut's word timings, following
.claude/skills/my-editing-style/SKILL.md (captions, punch-ins, whips, pop-ups, SFX).
Re-run after changing the EDL: python3 scripts/build_comp_launch.py"""
import html, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "edits/launch-step2/index.html"
data = json.load(open(ROOT / "assets/footage/launch-step2-cut.words.json"))
W, SEGS = data["words"], data["segments"]
TOTAL = SEGS[-1]["end"]
E = html.escape


def clean(t):
    return re.sub(r"[^\w$']", "", t).lower()


def at(word, after=0.0, which="start"):
    """time of the first word matching `word` starting at/after `after`"""
    for w in W:
        if w["start"] >= after - 1e-3 and clean(w["text"]) == word:
            return w[which]
    raise KeyError(word)


# ---------------------------------------------------------------- captions
# UK spelling for on-screen words; the voice is untouched
SPELL = {"program": "programme", "wait": "waitlist"}
DROP_AFTER_WAIT = True
KEYWORDS = [["plan"], ["cost"], ["launch"], ["name"], ["one", "sentence"], ["first"], ["trust"],
            ["nurture"], ["black", "friday"], ["bio"]]
for w in W:
    k = clean(w["text"])
    if k in SPELL:
        w["text"] = re.sub(k, SPELL[k], w["text"], flags=re.I)
# "wait list" -> "waitlist": fold "list" into the previous word
W2 = []
for w in W:
    if clean(w["text"]) == "list" and W2 and clean(W2[-1]["text"]) == "waitlist":
        W2[-1] = dict(W2[-1], end=w["end"])
        continue
    W2.append(w)
CW = W2
groups, cur = [], []
for i, w in enumerate(CW):
    cur.append(w)
    nxt = CW[i + 1] if i + 1 < len(CW) else None
    end_punct = w["text"][-1] in ".,?!"
    brk = (nxt is None or nxt["seg"] != w["seg"] or nxt["start"] - w["end"] >= 0.15
           or len(cur) >= 5 or (end_punct and len(cur) >= 2))
    if brk:
        groups.append(cur); cur = []
merged = []
for g in groups:
    if merged and len(g) == 1 and g[0]["end"] - g[0]["start"] < 0.45 and len(merged[-1]) < 5 \
            and g[0]["seg"] == merged[-1][-1]["seg"]:
        merged[-1] = merged[-1] + g
    else:
        merged.append(g)
groups = merged


def chip_span(g):
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
    span = chip_span(g)
    parts = []
    for j, w in enumerate(g):
        t = E(w["text"])
        if j == 0:
            t = t[:1].upper() + t[1:]
        if span and j == span[0]:
            parts.append('<span class="chip">')
        parts.append(t)
        if span and j == span[1] - 1:
            parts.append("</span>")
    text = " ".join(parts).replace('<span class="chip"> ', '<span class="chip">').replace(" </span>", "</span>")
    cap_html.append(f'<div class="cap" id="cap{gi}"><span class="pill">{text}</span></div>')
    cap_js.append(f'cap("#cap{gi}", {s:.3f}, {e:.3f});')

# ---------------------------------------------------------------- framing (punch-ins + whips)
WIDE, MED, TIGHT = 1.0, 1.15, 1.30
WHIPS = [SEGS[2]["start"], SEGS[8]["start"], SEGS[11]["start"]]  # into setup, existing clients, nurture
changes = [s["start"] for s in SEGS]
for name, after in [("sounds", 0.0), ("just", 3.0), ("where", 7.5), ("in", 13.0), ("the", 20.8)]:
    try:
        t = at(name, after)
        if all(abs(t - c) > 1.0 for c in changes):
            changes.append(t - 0.04)
    except KeyError:
        pass
changes = sorted(changes)
cycle = [MED, WIDE, TIGHT, MED, WIDE, TIGHT]
frames = [(t, cycle[i % len(cycle)]) for i, t in enumerate(changes)]
frame_js = []
for i, (t, sc) in enumerate(frames):
    if i and abs(sc - frames[i - 1][1]) < 1e-6:
        sc = MED if sc != MED else TIGHT
        frames[i] = (t, sc)
    if any(abs(t - wt) < 0.05 for wt in WHIPS):
        frame_js.append(f"whip({t:.3f}, {sc});")
    else:
        frame_js.append(f'tl.set("#cam", {{ scale: {sc} }}, {t:.3f});')
# emphasis punch on "first" (programme clients)
fp = at("first", 22.5)
cur_scale = [sc for t, sc in frames if t <= fp][-1]
frame_js.append(f'tl.to("#cam", {{ scale: {cur_scale + 0.08:.2f}, duration: 0.15, ease: "power3.out" }}, {fp:.3f});')

# ---------------------------------------------------------------- pop-ups
pops, pop_js, sfx = [], [], []
n = [0]


def pop(start, dur, inner, enter="rise", sound=None, vol=0.35, cls=""):
    n[0] += 1
    pid = f"p{n[0]}"
    start = max(0.0, start)
    dur = min(dur, TOTAL - start - 0.02)
    pops.append(f'<div id="{pid}" class="clip pop {cls}" data-start="{start:.3f}" data-duration="{dur:.3f}" '
                f'data-track-index="{2 + n[0]}" data-track-kind="graphics" data-layout-allow-overlap>{inner}</div>')
    sel, e = f"#{pid} .in", start + dur
    ENTER = {
        "rise": '{ opacity: 0, y: 40, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(2)", immediateRender: false }',
        "pop": '{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false }',
        "slam": '{ opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.12, ease: "power4.in", immediateRender: false }',
        "drift": '{ opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", immediateRender: false }',
    }
    if enter in ENTER:
        pop_js.append(f'tl.fromTo("{sel}", {ENTER[enter]}, {start:.3f});')
    if e - start > 0.6 and e < TOTAL - 0.1:
        pop_js.append(f'tl.to("{sel}", {{ opacity: 0, duration: 0.18, ease: "power2.in" }}, {e - 0.2:.3f});')
    if sound:
        sfx.append((sound, start, vol))
    return pid


def headline(main, sub=""):
    return f'<div class="in headline"><div class="h-main">{main}</div>' + (f'<div class="h-sub">{sub}</div>' if sub else "") + "</div>"


wh = at("whereas")
# 1 hook headline from frame 0
pop(0.0, wh - 0.05, headline("a name sounds like a plan."), enter="none")
# 2 proof by 0.5 s: a named programme card (lower zone)
pop(0.45, wh - 0.5, '''<div class="in low card named">
  <div class="n-label">your programme</div>
  <div class="n-title">The Clear Skin Programme</div>
  <div class="n-meta"><span>12 weeks</span><span>3 phases</span><span>1 plan</span></div></div>''', sound="pop")
# 3 the alternative: a course of treatments (lower zone), then the stamp on "cost"
co = at("cost")
pop(at("course") - 0.05, SEGS[2]["start"] - at("course") + 0.0, '''<div class="in low card course">
  <div class="c-row"><span>Treatment</span><span>×6</span></div>
  <div class="c-row"><span>Total</span><span class="c-pay">pay now</span></div></div>''')
ju = at("just")
pop(ju - 0.05, SEGS[2]["start"] - ju + 0.02, '<div class="in stamp">just a cost</div>', enter="slam", sound="impact-bass-1", vol=0.3)
# 4 the three steps, launch lit (top zone)
st = at("step")
la = at("launch")
pop(st - 0.05, SEGS[4]["start"] - st - 0.05, f'''<div class="in card steps">
  <div class="l-head">the clear code protocol</div>
  <div class="row done" data-at="{st + 0.15:.3f}">1 · plan</div>
  <div class="row hot" data-at="{la - 0.05:.3f}">2 · launch</div>
  <div class="row dim" data-at="{st + 0.45:.3f}">3 · nurture</div></div>''')
# 5 naming it: a name typed into a field (lower zone)
gv = at("give")
pop(gv - 0.05, SEGS[4]["start"] - gv + 0.7, f'''<div class="in low card field">
  <div class="f-label">programme name</div>
  <div class="f-box"><span class="typed" data-type="Clear Skin Programme" data-from="{gv + 0.15:.3f}" data-to="{at('name', 10.0, 'start'):.3f}"></span><span class="caret"></span></div></div>''',
    sound="typing", vol=0.25)
# 6 one sentence: who / how long / what changes (top zone)
ex = at("explain")
pop(ex - 0.05, SEGS[8]["start"] - ex + 0.6, f'''<div class="in card three">
  <div class="l-head">in your consultation</div>
  <div class="t-title">explain it in one sentence:</div>
  <div class="row" data-at="{at('who'):.3f}">who it's for</div>
  <div class="row" data-at="{at('how'):.3f}">how long it runs</div>
  <div class="row" data-at="{at('what', 16.0):.3f}">what changes along the way</div></div>''', sound="click", vol=0.35)
# 7 existing clients first (top)
xi = at("existing")
pop(xi - 0.05, SEGS[9]["start"] - xi + 0.0, headline("existing clients first."))
# 8 italic accent: trust
tr = at("trust")
pop(tr - 0.05, 1.5, '<div class="in accent"><span class="sp s1">✦</span>trust<span class="sp s2">✦</span><span class="sp s3">✦</span></div>',
    enter="drift", sound="sparkle", vol=0.25)
# 9 big number 3 on "three"
th = at("three")
pop(th - 0.05, at("and", 26.0) - th - 0.1, '<div class="in bignum">3</div>', enter="pop")
# 10 nurture keeps them
nk = at("keeps", 26.0)
pop(nk - 0.05, SEGS[13]["start"] - nk + 0.0, headline("nurture keeps them."))
# 11 doors open date card
dr = at("doors")
pop(dr - 0.05, SEGS[14]["start"] - dr + 0.0, f'''<div class="in card date">
  <div class="d-day">27</div><div class="d-txt"><div class="d-mon">november</div><div class="d-line">doors open · black friday</div></div></div>''',
    sound="pop")
# 12 waitlist in bio, to the end
jn = at("friday")
pop(jn - 0.05, TOTAL - jn + 0.05, '<div class="in low bio"><span class="arrow-up">↑</span>waitlist in bio</div>', sound="pop")

# whoosh on each whip (alternate takes)
for i, t in enumerate(WHIPS):
    sfx.append(("whoosh" if i % 2 == 0 else "whoosh-short", t - 0.02, 0.4))

PEAK = {"pop": 0.119, "click": 0.072, "impact-bass-1": 0.073, "sparkle": 0.025, "whoosh": 0.162, "whoosh-short": 0.162, "typing": 0.05}
DUR = {"pop": 0.72, "click": 0.37, "impact-bass-1": 2.12, "sparkle": 1.8, "whoosh": 0.57, "whoosh-short": 0.57, "typing": 1.2}
audio = []
for k, (name, t, vol) in enumerate(sfx):
    st = max(0.0, t + 1 / 30 - PEAK[name])  # peak lands one frame after the picture
    d = min(DUR[name], TOTAL - st - 0.01)
    audio.append(f'<audio id="sfx{k}" class="clip" src="sfx/{name}.mp3" data-start="{st:.3f}" data-duration="{d:.3f}" '
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
@font-face {{ font-family: "Source Serif 4"; font-weight: 900; font-style: italic; src: url("fonts/source-serif-4-latin-900-italic.woff2") format("woff2"); }}
:root {{ --red:#ae1f14; --cream:#f2f0e0; --pink:#ffd7de; --white:#fff; --serif:"Source Serif 4", serif; --sans:"Outfit", sans-serif; }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:1080px; height:1920px; overflow:hidden; background:#000; }}
#root {{ position:relative; width:1080px; height:1920px; overflow:hidden; }}
#cam {{ position:absolute; inset:0; transform-origin:50% 36%; will-change:transform, filter; }}
#footage {{ position:absolute; inset:0; width:1080px; height:1920px; object-fit:cover; }}

/* captions */
#captions {{ position:absolute; inset:0; pointer-events:none; }}
.cap {{ position:absolute; left:0; right:0; top:1340px; text-align:center; opacity:0; visibility:hidden; }}
.pill {{ display:inline-block; max-width:900px; background:var(--cream); color:var(--red); font:700 52px/1.18 var(--sans);
  padding:14px 28px 16px; border-radius:999px; box-shadow:0 6px 18px rgba(0,0,0,.18); letter-spacing:-0.01em; }}
.chip {{ background:var(--red); color:var(--pink); border-radius:10px; padding:0 10px 2px; margin:0 2px; }}

/* pop-ups: each .pop is a full-frame clip; .in is the positioned element */
.pop {{ pointer-events:none; }}
.pop .in {{ position:absolute; left:0; right:0; margin-inline:auto; width:fit-content; top:110px; }}
.pop .in.cover {{ top:262px; }}  /* sits over the source's burned-in title (y≈300-345) */
.headline {{ background:var(--red); color:var(--cream); border-radius:22px; padding:22px 40px 26px; text-align:center; white-space:nowrap;
  box-shadow:0 14px 34px rgba(0,0,0,.25); }}
.h-main {{ font:900 76px/1.02 var(--serif); letter-spacing:-0.05em; }}
.h-sub {{ font:600 36px/1.2 var(--sans); color:var(--pink); margin-top:8px; }}
.card {{ background:var(--cream); color:var(--red); border:8px solid var(--cream); border-radius:28px;
  box-shadow:0 18px 40px rgba(0,0,0,.28); padding:30px 36px; max-width:840px; }}
.paywall {{ rotate:-2deg; width:820px !important; }}
.pw-journal {{ font:600 28px var(--sans); letter-spacing:.08em; text-transform:uppercase; opacity:.75; }}
.pw-title {{ font:900 42px/1.08 var(--serif); letter-spacing:-0.03em; margin:10px 0 18px; }}
.pw-lock {{ display:flex; align-items:center; gap:16px; background:var(--red); color:var(--cream); border-radius:14px;
  padding:14px 22px; font:500 32px var(--sans); }}
.pw-lock b {{ font-weight:800; color:var(--pink); }}
.lock {{ width:30px; height:24px; background:var(--pink); border-radius:5px; position:relative; margin-top:12px; }}
.lock::before {{ content:""; position:absolute; left:5px; top:-16px; width:20px; height:20px; border:5px solid var(--pink);
  border-bottom:none; border-radius:12px 12px 0 0; box-sizing:border-box; }}
.jargon {{ rotate:2deg; width:800px !important; }}
.j-label {{ display:inline-block; background:var(--red); color:var(--pink); font:700 30px var(--sans); border-radius:999px; padding:6px 20px; margin-bottom:14px; }}
.jargon p {{ font:400 31px/1.35 var(--serif); color:#5a3a33; filter:blur(1.2px); }}
.jargon mark {{ background:var(--pink); color:var(--red); filter:none; }}
.stamp {{ top:150px; font:800 92px/1 var(--sans); text-transform:uppercase; color:var(--red); border:9px solid var(--red);
  border-radius:16px; padding:14px 30px 18px; white-space:nowrap; background:rgba(242,240,224,.82); rotate:-8deg; letter-spacing:.02em; }}
.list.two {{ display:flex; align-items:center; justify-content:center; gap:28px; width:auto; padding:24px 40px; }}
.list.two .row {{ font:900 64px var(--serif); letter-spacing:-0.04em; opacity:0; }}
.list.two .arrow {{ font:700 56px var(--sans); }}
.list.three {{ width:780px !important; }}
.l-head {{ display:inline-block; background:var(--red); color:var(--pink); font:700 30px var(--sans); border-radius:999px; padding:8px 22px; margin-bottom:16px; }}
.list.t-title {{ font:900 52px/1.1 var(--serif); letter-spacing:-0.04em; margin-bottom:8px; }}
.three .row {{ font:600 36px/1.5 var(--sans); opacity:0; }}
.stack {{ width:760px !important; height:360px; }}
.jr {{ position:absolute; width:236px; height:320px; background:var(--cream); border:6px solid var(--cream); border-radius:18px;
  box-shadow:0 14px 30px rgba(0,0,0,.25); display:flex; align-items:flex-end; padding:22px; }}
.jr::before {{ content:""; position:absolute; left:0; right:0; top:0; height:120px; background:var(--red); border-radius:12px 12px 0 0; }}
.jr span {{ font:900 28px/1.05 var(--serif); letter-spacing:-0.03em; color:var(--red); }}
.j1 {{ left:0; top:30px; rotate:-6deg; }} .j2 {{ left:262px; top:0; rotate:1deg; }} .j3 {{ left:524px; top:30px; rotate:6deg; }}
.accent {{ top:150px; font:900 italic 150px/1 var(--serif); color:var(--pink); letter-spacing:-0.04em; white-space:nowrap;
  text-shadow:0 8px 26px rgba(0,0,0,.35); }}
.sp {{ position:absolute; color:var(--cream); font-style:normal; font-size:52px; }}
.s1 {{ left:-60px; top:-10px; }} .s2 {{ right:-56px; top:20px; font-size:40px; }} .s3 {{ right:30px; bottom:-40px; font-size:34px; }}
.paper {{ rotate:-1.5deg; width:840px !important; }}
.pp-head {{ display:flex; align-items:center; gap:14px; font:600 28px var(--sans); letter-spacing:.04em; }}
.pp-mark {{ display:inline-grid; place-items:center; width:52px; height:52px; border-radius:50%; background:var(--red); color:var(--pink);
  font:900 34px/1 var(--serif); padding-bottom:6px; }}
.pp-title {{ font:900 50px/1.04 var(--serif); letter-spacing:-0.04em; margin:14px 0 12px; }}
.pp-line {{ font:400 30px/1.35 var(--sans); color:#5a3a33; }}
.bignum {{ top:120px; font:900 210px/1 var(--serif); letter-spacing:-0.05em; color:var(--red); -webkit-text-stroke:20px var(--cream);
  paint-order:stroke fill; rotate:-3deg; white-space:nowrap; filter:drop-shadow(0 10px 24px rgba(0,0,0,.3)); }}
.grade {{ width:780px !important; }}
.g-label {{ font:700 30px var(--sans); text-transform:uppercase; letter-spacing:.08em; margin-bottom:16px; }}
.g-bars {{ display:flex; gap:14px; }}
.g {{ flex:1; text-align:center; font:600 32px var(--sans); padding:18px 0; border-radius:14px; border:4px solid rgba(174,31,20,.3); color:rgba(174,31,20,.5); }}
.g.on.lit {{ background:var(--red); color:var(--pink); border-color:var(--red); }}
.bio {{ top:150px; display:flex; align-items:center; gap:18px; background:var(--red); color:var(--cream); font:800 64px var(--sans);
  border-radius:999px; padding:18px 44px 22px; box-shadow:0 14px 34px rgba(0,0,0,.25); white-space:nowrap; }}
.arrow-up {{ color:var(--pink); font-size:70px; }}
.pop .in.low {{ top:1010px; }}
.named {{ rotate:-2deg; width:760px !important; padding:24px 34px; }}
.n-label, .f-label {{ font:700 28px var(--sans); text-transform:uppercase; letter-spacing:.08em; opacity:.75; }}
.n-title {{ font:900 54px/1.04 var(--serif); letter-spacing:-0.04em; margin:8px 0 14px; }}
.n-meta {{ display:flex; gap:12px; }}
.n-meta span {{ background:var(--red); color:var(--pink); font:600 28px var(--sans); border-radius:999px; padding:6px 18px; }}
.course {{ rotate:2deg; width:640px !important; padding:22px 32px; color:#6b5a55; }}
.c-row {{ display:flex; justify-content:space-between; font:500 38px/1.5 var(--sans); }}
.c-pay {{ color:var(--red); font-weight:800; }}
.steps {{ width:640px !important; }}
.steps .row {{ font:700 46px/1.45 var(--sans); opacity:0; }}
.steps .row.done {{ text-decoration:line-through; text-decoration-thickness:4px; color:#9c4a40; }}
.steps .row.hot {{ display:inline-block; background:var(--red); color:var(--pink); border-radius:14px; padding:0 18px; margin-left:-18px; }}
.steps .row.dim {{ color:#9c4a40; }}
.field {{ width:760px !important; padding:24px 32px; }}
.f-box {{ margin-top:12px; border:4px solid var(--red); border-radius:16px; padding:14px 20px; font:700 46px var(--sans); min-height:84px;
  display:flex; align-items:center; white-space:nowrap; }}
.caret {{ display:inline-block; width:4px; height:48px; background:var(--red); margin-left:4px; }}
.three {{ width:800px !important; }}
.t-title {{ font:900 52px/1.1 var(--serif); letter-spacing:-0.04em; margin-bottom:8px; }}
.three .row {{ font:600 40px/1.5 var(--sans); opacity:0; }}
.date {{ display:flex; align-items:center; gap:28px; padding:22px 40px; rotate:-2deg; }}
.d-day {{ font:900 150px/0.9 var(--serif); letter-spacing:-0.05em; }}
.d-mon {{ font:900 54px/1 var(--serif); letter-spacing:-0.04em; }}
.d-line {{ font:600 32px var(--sans); margin-top:8px; white-space:nowrap; }}
.wm {{ position:absolute; left:930px; top:1700px; font:900 64px/1 var(--serif); letter-spacing:-0.05em; color:var(--cream); opacity:.7; }}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL:.3f}" data-width="1080" data-height="1920">
  <div id="cam">
    <video id="footage" class="clip" src="footage/launch-step2-cut.mp4" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="0"
      playsinline data-has-audio="true"></video>
  </div>
  <div class="clip wm" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="2">c.</div>
  {"".join(pops)}
  <div id="captions" class="clip" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="1" data-track-kind="captions" data-layout-allow-overlap>
    {"".join(cap_html)}
  </div>
  {"".join(audio)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
tl.set("#cam", {{ scale: 1, y: 0, filter: "blur(0px)" }}, 0);
function whip(t, sc) {{
  tl.to("#cam", {{ scale: "+=0.22", y: -140, filter: "blur(22px)", duration: 0.13, ease: "power2.in" }}, t - 0.13);
  tl.fromTo("#cam", {{ scale: sc + 0.22, y: 140, filter: "blur(22px)" }}, {{ scale: sc, y: 0, filter: "blur(0px)", duration: 0.16, ease: "power2.out", immediateRender: false }}, t);
}}
function cap(sel, s, e) {{
  tl.set(sel, {{ visibility: "visible" }}, s);
  tl.fromTo(sel, {{ opacity: 0, y: 12 }}, {{ opacity: 1, y: 0, duration: 0.12, ease: "power2.out", immediateRender: false }}, s);
  tl.to(sel, {{ opacity: 0, duration: 0.08, ease: "power2.in" }}, e - 0.08);
  tl.set(sel, {{ opacity: 0, visibility: "hidden" }}, e);
}}
{chr(10).join(frame_js)}
{chr(10).join(pop_js)}
// staged reveals inside cards
document.querySelectorAll("[data-at]").forEach((el) => {{
  const t = parseFloat(el.dataset.at);
  if (el.classList.contains("g")) tl.set(el, {{ className: "g on lit" }}, t);
  else tl.fromTo(el, {{ opacity: 0, x: -24 }}, {{ opacity: 1, x: 0, duration: 0.25, ease: "power2.out", immediateRender: false }}, t);
}});
document.querySelectorAll(".sp").forEach((el, i) => {{
  const host = el.closest(".pop"); const s = parseFloat(host.dataset.start);
  tl.fromTo(el, {{ scale: 0.3, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.3, ease: "back.out(3)", immediateRender: false }}, s + 0.1 + (i % 3) * 0.12);
}});
// typed text: one character per step between data-from and data-to
document.querySelectorAll(".typed").forEach((el) => {{
  const txt = el.dataset.type, a = parseFloat(el.dataset.from), b = parseFloat(el.dataset.to);
  for (let i = 0; i <= txt.length; i++) tl.set(el, {{ textContent: txt.slice(0, i) }}, a + (b - a) * i / txt.length);
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
      f"{len(frames)} framing changes, duration {TOTAL:.3f}s")
for t, sc in frames:
    print(f"  framing {t:6.2f}s -> {sc}")
