"""Build edits/four-reasons-01/index.html from the cut's word timings, following
.claude/skills/my-editing-style/SKILL.md (captions, punch-ins, whips, pop-ups, SFX).
Re-run after changing the EDL: python3 scripts/build_comp.py"""
import html, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "edits/four-reasons-01/index.html"
data = json.load(open(ROOT / "assets/footage/take02-cut.words.json"))
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
KEYWORDS = [["four"], ["paywalls"], ["paywall"], ["thirty", "pounds"], ["medical"], ["statistics"], ["moving"],
            ["brands"], ["distributors"], ["social", "media"], ["commercial"], ["clear", "evidence"],
            ["plain", "english"], ["graded"], ["five", "minutes"], ["sponsors"], ["bio"]]
groups, cur = [], []
for i, w in enumerate(W):
    cur.append(w)
    nxt = W[i + 1] if i + 1 < len(W) else None
    end_punct = w["text"][-1] in ".,?!"
    brk = (nxt is None or nxt["seg"] != w["seg"] or nxt["start"] - w["end"] >= 0.15
           or len(cur) >= 5 or (end_punct and len(cur) >= 2))
    if brk:
        groups.append(cur); cur = []
# merge a lone trailing word into its neighbour when it would flash
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
            e = ns  # hold until the next group instead of blinking off
    e = min(e, TOTAL - 0.02)
    span = chip_span(g)
    parts = []
    for j, w in enumerate(g):
        t = E(w["text"])
        if span and j == span[0]:
            parts.append('<span class="chip">')
        parts.append(t + ("" if span and span[0] <= j < span[1] - 1 else ""))
        if span and j == span[1] - 1:
            parts.append("</span>")
    text = " ".join(parts).replace('<span class="chip"> ', '<span class="chip">').replace(" </span>", "</span>")
    cap_html.append(f'<div class="cap" id="cap{gi}"><span class="pill">{text}</span></div>')
    cap_js.append(f'cap("#cap{gi}", {s:.3f}, {e:.3f});')

# ---------------------------------------------------------------- framing (punch-ins + whips)
WIDE, MED, TIGHT = 1.0, 1.10, 1.20  # 1080p source: no headroom past 1.2x
SOL = next(s["start"] for s in SEGS if s["beat"] == "SOLUTION")
CTA = next(s["start"] for s in SEGS if s["beat"] == "CTA")
R = {b: next(s["start"] for s in SEGS if s["beat"].startswith(b)) for b in ("R1", "R2", "R3", "R4")}
WHIPS = [R["R1"], SOL]  # into the reasons, and into the solution
changes = sorted(s["start"] for s in SEGS)
cycle = [WIDE, MED, TIGHT, MED, WIDE, TIGHT]
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
# emphasis punch on "commercial"
cm = at("commercial")
cur_scale = [sc for t, sc in frames if t <= cm][-1]
frame_js.append(f'tl.to("#cam", {{ scale: {cur_scale + 0.06:.2f}, duration: 0.15, ease: "power3.out" }}, {cm:.3f});')

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
        "rise": '{{ opacity: 0, y: 40, scale: 0.92 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(2)", immediateRender: false }}',
        "pop": '{{ opacity: 0, scale: 0.6 }}, {{ opacity: 1, scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false }}',
        "slam": '{{ opacity: 0, scale: 1.6 }}, {{ opacity: 1, scale: 1, duration: 0.12, ease: "power4.in", immediateRender: false }}',
        "drift": '{{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.4, ease: "power2.out", immediateRender: false }}',
    }
    if enter in ENTER:
        pop_js.append(f'tl.fromTo("{sel}", {ENTER[enter].replace("{{", "{").replace("}}", "}")}, {start:.3f});')
    if e - start > 0.6:
        pop_js.append(f'tl.to("{sel}", {{ opacity: 0, duration: 0.18, ease: "power2.in" }}, {e - 0.2:.3f});')
    if sound:
        sfx.append((sound, start, vol))
    return pid


def headline(main, sub="", cover=False):
    s = f'<div class="in headline{" cover" if cover else ""}"><div class="h-main">{main}</div>' + (f'<div class="h-sub">{sub}</div>' if sub else "") + "</div>"
    return s


def reason(num, label):
    return f'<div class="in reason"><span class="num">{num}</span><span class="lab">{label}</span></div>'


# hook headline, on screen from frame 0
fr = at("four")
pop(0.0, fr - 0.05, headline("Skincare evidence isn't easy to find."), enter="none")
pop(fr - 0.05, R["R1"] - fr - 0.05, '<div class="in bignum top4">4 reasons</div>', enter="pop", sound="pop")
# chapter pills, one per reason, held for the whole reason
ends = [R["R2"], R["R3"], R["R4"], SOL]
for (k, label), e in zip([("R1", "Paywalls"), ("R2", "Written for clinicians"), ("R3", "It keeps moving"),
                          ("R4", "Commercial interest")], ends):
    pop(R[k], e - R[k] - 0.05, reason(k[1], label), enter="rise", sound="pop")
# R1: paywall card, then the price
pw = at("paywall", R["R1"] + 1)
th = at("thirty")
pop(pw - 0.05, th - pw - 0.1, """<div class="in side card paywall">
  <div class="pw-journal">British Journal of Dermatology</div>
  <div class="pw-title">Niacinamide and hyper&shy;pigmentation: a trial</div>
  <div class="pw-lock"><span class="lock"></span><span>Purchase <b>£30.00</b></span></div></div>""", sound="click")
pop(th - 0.05, R["R2"] - th - 0.1, '<div class="in side bignum">£30</div>', enter="pop", sound="pop")
# R2: jargon
st = at("medical")
pop(st - 0.05, R["R3"] - st - 0.1, """<div class="in side card jargon">
  <div class="j-label">statistics &amp; terminology</div>
  <p data-layout-ignore>…transepidermal water loss attenuated via filaggrin upregulation; heterogeneity
  (I² = 74%) precluded pooled <mark>odds ratio</mark> estimation…</p></div>""", sound="pop")
# R3: outdated stamp
mn = at("may", R["R3"] + 1)
pop(mn - 0.05, R["R4"] - mn - 0.1, '<div class="in side stamp">outdated</div>', enter="slam", sound="impact-bass-1", vol=0.3)
# R4: who we rely on, then the stamp
br, di, so = at("brands"), at("distributors"), at("social")
bu = at("but", br)
br_end = next(s["end"] for s in SEGS if s["start"] <= br < s["end"])  # cover card hides the lean until here
br = br_end
pop(br, bu - br - 0.1, f"""<div class="in side card list three">
  <div class="l-head">where we learn</div>
  <div class="row" data-at="{br:.3f}">brands</div>
  <div class="row" data-at="{di:.3f}">distributors</div>
  <div class="row" data-at="{so:.3f}">social media</div></div>""", sound="pop")
pop(cm - 0.05, SOL - cm - 0.1, '<div class="in side stamp">sponsored</div>', enter="slam", sound="impact-bass-1", vol=0.3)
# solution
ce = at("clear", SOL)
pop(ce - 0.05, 2.4, headline("Clear Evidence", "made for skin specialists"), sound="pop")
pr = at("peerreviewed", SOL)
gr = at("graded")
pop(pr - 0.05, gr - pr - 0.1, """<div class="in side card paper">
  <div class="pp-head"><span class="pp-mark">c.</span><span>Monthly paper</span></div>
  <div class="pp-title">Does niacinamide fade dark spots?</div>
  <div class="pp-line">Short answer: yes, at 4–5%.</div></div>""", sound="pop")
fv = at("five")
pop(gr - 0.05, fv - gr - 0.1, f"""<div class="in side card grade">
  <div class="g-label">Evidence strength</div>
  <div class="g-bars"><div class="g on" data-at="{gr + 0.35:.3f}">strong</div><div class="g">moderate</div><div class="g">weak</div></div></div>""",
    sound="click")
sp = at("sponsors")
pop(fv - 0.05, sp - fv - 0.15, '<div class="in side bignum">5 min</div>', enter="pop", sound="pop")
pop(sp - 0.05, CTA - sp - 0.1, '<div class="in side stamp">no brand deals</div>', enter="slam", sound="impact-bass-1", vol=0.3)
lk = at("barriers")
pop(lk - 0.05, TOTAL - lk + 0.03, '<div class="in bio"><span class="arrow-up">↑</span>link in bio</div>', sound="pop")


# Full-screen cards over the take endings where the speaker leans toward the phone to stop recording
# (found with scripts/lean_check.py). Voice carries on underneath; the next take starts clean.
def seg_end(t):
    return next(s["end"] for s in SEGS if s["start"] <= t < s["end"])
for word, after, text in [("audience", 15.0, "medical audience."), ("terminology", 17.0, "terminology"),
                          ("brands", 25.0, "brands,"), ("evidence", SOL, "Clear Evidence."), ("english", SOL, "plain English")]:
    ws = at(word, after)
    a = ws - 0.03; e = seg_end(ws + 0.01)
    n[0] += 1
    pops.append(f'<div id="cv{n[0]}" class="clip pop covercard" data-start="{a:.3f}" data-duration="{e - a:.3f}" '
                f'data-track-index="{2 + n[0]}" data-track-kind="graphics" data-layout-allow-overlap data-layout-allow-occlusion>'
                f'<div class="cc"><span class="cc-mark">c.</span><span class="cc-word">{text}</span></div></div>')

# whoosh on each whip (alternate takes)
for i, t in enumerate(WHIPS):
    sfx.append(("whoosh" if i % 2 == 0 else "whoosh-short", t - 0.02, 0.4))

PEAK = {"pop": 0.119, "click": 0.072, "impact-bass-1": 0.073, "sparkle": 0.025, "whoosh": 0.162, "whoosh-short": 0.162}
DUR = {"pop": 0.72, "click": 0.37, "impact-bass-1": 2.12, "sparkle": 1.8, "whoosh": 0.57, "whoosh-short": 0.57}
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
#cam {{ position:absolute; inset:0; transform-origin:35% 30%; will-change:transform, filter; }}
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
.pop .in.cover {{ top:262px; }}
/* right-hand zone beside the face (face sits upper-left in this framing) */
.pop .in.side {{ left:auto; right:34px; margin:0; top:430px; max-width:520px; }}
.side.card {{ width:520px !important; padding:24px 28px; }}
.side.bignum {{ font-size:170px; top:470px; }}
.side.stamp {{ font-size:66px; top:520px; }}
.bignum.top4 {{ font-size:130px; top:110px; }}
.reason {{ display:flex; align-items:center; gap:18px; background:var(--red); color:var(--cream); border-radius:999px;
  padding:10px 34px 12px 12px; box-shadow:0 12px 30px rgba(0,0,0,.25); white-space:nowrap; }}
.reason .num {{ display:grid; place-items:center; width:92px; height:92px; border-radius:50%; background:var(--pink); color:var(--red);
  font:900 70px/1 var(--serif); padding-bottom:8px; }}
.reason .lab {{ font:900 52px/1 var(--serif); letter-spacing:-0.04em; }}  /* sits over the source's burned-in title (y≈300-345) */
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
.list.three .row {{ font:600 36px/1.5 var(--sans); opacity:0; }}
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
.side.bignum {{ font-size:140px; top:470px; right:44px; }}
.side.stamp {{ font-size:50px; top:520px; right:44px; padding:10px 22px 14px; border-width:7px; }}
.headline {{ white-space:normal; max-width:980px; }}
.headline .h-main {{ font-size:68px; }}
.side.card .pw-title, .side.card .pp-title {{ font-size:40px; }}
.side.card .g {{ font-size:28px; }}
.covercard {{ z-index:50; }}
.cc {{ position:absolute; inset:0; background:var(--cream); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:30px; }}
.cc-word {{ font:900 136px/1 var(--serif); letter-spacing:-0.05em; color:var(--red); text-align:center; padding:0 60px; }}
.cc-mark {{ font:900 60px/1 var(--serif); color:var(--pink); background:var(--red); width:110px; height:110px; border-radius:50%;
  display:grid; place-items:center; padding-bottom:10px; }}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL:.3f}" data-width="1080" data-height="1920">
  <div id="cam">
    <video id="footage" class="clip" src="footage/take02-cut.mp4" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="0"
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
