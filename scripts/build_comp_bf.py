"""Black Friday doors-open reel (27 Nov): hook, captions, offer cards and the red end page over black-friday-comp.mp4.
python3 scripts/build_comp_bf.py"""
import html, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "edits/black-friday/index.html"
d = json.load(open(ROOT / "assets/footage/black-friday-cut.words.json"))
W, SEGS = d["words"], d["segments"]
TOTAL = SEGS[-1]["end"]
E = html.escape
span = {}
for s in SEGS:
    a, b = span.get(s["beat"], (s["start"], s["end"]))
    span[s["beat"]] = (min(a, s["start"]), max(b, s["end"]))

FIX = {"program": "programme", "397,": "£397,", "697.": "£697.", "19": "£19"}
words = []
for w in W:
    w = dict(w); k = re.sub(r"[^\w-]", "", w["text"]).lower()
    if w["text"].lower() in FIX:
        w["text"] = FIX[w["text"].lower()]
    elif k in FIX:
        w["text"] = re.sub(k, FIX[k], w["text"], flags=re.I)
    if k == "pounds" and words and words[-1]["text"] == "£19":
        words[-1]["end"] = w["end"]; continue
    if k == "list" and words and words[-1]["text"].lower().startswith("waitlist"):
        words[-1]["end"] = w["end"]; continue
    words.append(w)
groups, cur = [], []
for i, w in enumerate(words):
    cur.append(w); n = words[i + 1] if i + 1 < len(words) else None
    if n is None or n["seg"] != w["seg"] or n["start"] - w["end"] >= 0.15 or len(cur) >= 5 or (w["text"][-1] in ".,?!" and len(cur) >= 2):
        groups.append(cur); cur = []
HOOK_END = span["HOOK"][1]  # on-screen hook for the first few seconds (user, 21 Nov); captions take over after it
cap_html, cap_js = [], []
for gi, g in enumerate(groups):
    if g[-1]["end"] <= HOOK_END + 0.05:
        continue
    s = max(0.1, g[0]["start"] - 0.05); e = g[-1]["end"]
    if gi + 1 < len(groups) and groups[gi + 1][0]["start"] - 0.05 - e < 0.35:
        e = groups[gi + 1][0]["start"] - 0.05
    t = " ".join(E(w["text"]) for w in g); t = t[:1].upper() + t[1:]
    cap_html.append(f'<div class="cap" id="c{gi}"><span class="ct">{t}</span></div>')
    cap_js.append(f'cap("#c{gi}", {s:.3f}, {min(e, TOTAL - 0.02):.3f});')

lab_html, lab_js = [], []  # no labels over the website: they hid the page (user, 21 Nov)
ep = span["CTA"][0]

t19 = next(w["start"] for w in words if w["text"].lower() == "monthly")
def offer(sel, a, b):
    return (f'tl.fromTo("{sel}", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "expo.out", immediateRender: false }}, {a:.3f});\n'
            f'tl.to("{sel}", {{ opacity: 0, duration: 0.25 }}, {b - 0.25:.3f});')
offer_js = offer("#o1", span["PRICES"][0] + 0.1, span["PRICES"][1]) + "\n" + offer("#o2", t19 - 0.15, span["EVIDENCE"][1])
page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="vendor/gsap-3.15.0.min.js"></script>
<style>
@font-face {{ font-family: "Source Serif 4"; font-weight: 900; font-style: normal; src: url("fonts/source-serif-4-latin-900-normal.woff2") format("woff2"); }}
@font-face {{ font-family: "Source Serif 4"; font-weight: 900; font-style: italic; src: url("fonts/source-serif-4-latin-900-italic.woff2") format("woff2"); }}
:root {{ --red:#ae1f14; --cream:#f2f0e0; --pink:#ffd7de; --ink:#5a3a33; --serif:"Source Serif 4", serif; --sans:"Outfit", sans-serif; }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:1080px; height:1920px; overflow:hidden; background:#000; }}
#root {{ position:relative; width:1080px; height:1920px; overflow:hidden; }}
#footage {{ position:absolute; inset:0; width:1080px; height:1920px; object-fit:cover; }}
.lab {{ position:absolute; left:0; right:0; top:420px; text-align:center; opacity:0; z-index:4; }}
.lab span {{ display:inline-block; background:var(--red); color:var(--cream); font:900 46px/1.1 var(--serif); letter-spacing:-0.04em;
  padding:16px 30px; border-radius:6px; box-shadow:0 14px 34px rgba(60,10,6,.25); }}
.cap {{ position:absolute; left:80px; right:80px; top:400px; text-align:center; opacity:0; visibility:hidden; z-index:5; }}
.ct {{ display:inline; font:500 42px/1.6 var(--sans); color:var(--cream); background:var(--ink); padding:8px 20px; border-radius:12px;
  -webkit-box-decoration-break:clone; box-decoration-break:clone; }}
#hook {{ position:absolute; left:70px; right:70px; top:352px; text-align:center; z-index:5; opacity:0; }}
#hook span {{ font:900 96px/1.0 var(--serif); letter-spacing:-0.05em; color:var(--red); }}
.offer {{ position:absolute; left:36px; top:1180px; width:520px; background:var(--cream); color:var(--red); border-radius:8px; padding:30px 36px 32px;
  box-shadow:0 18px 50px rgba(40,6,4,.24); z-index:5; opacity:0; }}
.offer .ey {{ font:600 24px/1 var(--sans); letter-spacing:.16em; text-transform:uppercase; color:var(--ink); padding-bottom:16px; border-bottom:1.5px solid rgba(174,31,20,.28); }}
.offer .row {{ display:flex; justify-content:space-between; align-items:baseline; margin-top:18px; }}
.offer .row b {{ font:900 46px/1 var(--serif); letter-spacing:-0.04em; }}
.offer .row i {{ font:italic 900 52px/1 var(--serif); letter-spacing:-0.03em; }}
.offer .sm {{ font:500 26px/1.3 var(--sans); color:var(--ink); margin-top:6px; }}
.offer .big {{ font:italic 900 110px/1 var(--serif); letter-spacing:-0.04em; margin-top:16px; }}
.offer .big span {{ font:500 34px var(--sans); font-style:normal; letter-spacing:0; color:var(--ink); }}
#endp {{ position:absolute; inset:0; background:var(--red); color:var(--cream); z-index:3; clip-path:inset(0% 100% 0% 0%);
  display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:34px; padding:0 100px; }}
#endp b {{ font:900 170px/1 var(--serif); letter-spacing:-0.05em; }}
#endp h2 {{ font:900 92px/1.02 var(--serif); letter-spacing:-0.05em; }}
#endp .s {{ font:italic 900 48px/1.2 var(--serif); color:var(--pink); opacity:0; }}
#endp .pill {{ font:600 40px/1 var(--sans); border:3px solid var(--cream); border-radius:999px; padding:22px 48px; opacity:0; }}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL:.3f}" data-width="1080" data-height="1920">
  <video id="footage" class="clip" src="footage/black-friday-comp.mp4" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="0" playsinline data-has-audio="true"></video>
  <div id="ov" class="clip" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="1" data-track-kind="graphics" data-layout-allow-overlap style="position:absolute;inset:0">
    {"".join(lab_html)}
    <div id="hook"><span>doors are open.</span></div>
    <div class="offer" id="o1"><div class="ey">black friday · the clear code protocol</div><div class="row"><b>core</b><i>£397</i></div><div class="sm">or 3 × £139</div><div class="row"><b>advanced</b><i>£697</i></div><div class="sm">+ three 1-1 calls · only 5 places</div></div>
    <div class="offer" id="o2"><div class="ey">black friday · clear evidence</div><div class="big">£19<span> a month</span></div><div class="sm">for your first 3 months</div></div>
    <div id="endp"><b>c.</b><h2>black friday prices end cyber monday.</h2><p class="s">the clear code protocol · clear evidence</p><p class="pill">link in bio</p></div>
    {"".join(cap_html)}
  </div>
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
function lab(sel, a, b) {{
  tl.fromTo(sel, {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: "power3.out", immediateRender: false }}, a);
  tl.to(sel, {{ opacity: 0, duration: 0.15 }}, b - 0.15);
}}
function cap(sel, s, e) {{
  tl.set(sel, {{ visibility: "visible" }}, s);
  tl.fromTo(sel, {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.2, ease: "power2.out", immediateRender: false }}, s);
  tl.set(sel, {{ opacity: 0, visibility: "hidden" }}, e);
}}
{chr(10).join(lab_js)}
tl.fromTo("#hook", {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false }}, 0.05);
tl.to("#hook", {{ opacity: 0, y: -10, duration: 0.25, ease: "power2.in" }}, {HOOK_END - 0.25:.3f});
{offer_js}
tl.to("#endp", {{ clipPath: "inset(0% 0% 0% 0%)", duration: 0.4, ease: "expo.out" }}, {ep:.3f});
tl.to("#endp .s", {{ opacity: 1, duration: 0.3 }}, {ep + 0.6:.3f});
tl.to("#endp .pill", {{ opacity: 1, duration: 0.3 }}, {span["CTA"][0]:.3f});
{chr(10).join(cap_js)}
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
'''
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(page)
print(f"wrote {OUT.relative_to(ROOT)}: {len(groups)} caption groups, duration {TOTAL:.3f}s")
