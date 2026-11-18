"""Clear Evidence reel as a voiceover: full-frame brand scenes over the user's voice (no talking-head
background on screen). Audio comes from the cut footage, which stays mounted but hidden.
python3 scripts/build_comp_evidence_vo.py"""
import html, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAME = "evidence-step-vo"
OUT = ROOT / "edits" / NAME / "index.html"
data = json.load(open(ROOT / "assets/footage/evidence-step-cut.words.json"))
W, SEGS = data["words"], data["segments"]
TOTAL = SEGS[-1]["end"]
E = html.escape


def clean(t):
    return re.sub(r"[^\w$']", "", t).lower()


def at(word, after=0.0):
    for w in W:
        if w["start"] >= after - 1e-3 and clean(w["text"]) == word:
            return w["start"]
    raise KeyError(word)


# ---------------------------------------------------------------- captions (red pill, readable on every ground)
KEYWORDS = [["research", "paper"], ["fast"], ["every", "week"], ["hours"], ["clinic"], ["clear", "evidence"],
            ["five", "minutes"], ["practice"], ["upgrade"], ["bio"]]
groups, cur = [], []
for i, w in enumerate(W):
    cur.append(w)
    nxt = W[i + 1] if i + 1 < len(W) else None
    if (nxt is None or nxt["seg"] != w["seg"] or nxt["start"] - w["end"] >= 0.15
            or len(cur) >= 5 or (w["text"][-1] in ".,?!" and len(cur) >= 2)):
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
        words[span[0]] = "<em>" + words[span[0]]
        words[span[1] - 1] = words[span[1] - 1] + "</em>"
    cap_html.append(f'<div class="cap" id="cap{gi}"><span class="ct">{" ".join(words)}</span></div>')
    cap_js.append(f'cap("#cap{gi}", {s:.3f}, {e:.3f});')

# ---------------------------------------------------------------- scenes
scenes, scene_js = [], []
B = [s["start"] for s in SEGS]


def scene(k, start, end, ground, inner):
    scenes.append(f'<div id="sc{k}" class="clip scene {ground}" data-start="{start:.3f}" data-duration="{end - start:.3f}" '
                  f'data-track-index="{10 + k}" data-track-kind="graphics" data-layout-allow-overlap>'
                  f'<div class="frame"></div>{inner}</div>')
    scene_js.append(f'enter("#sc{k}", {start:.3f});')


def rv(t, content, cls="", tag="div"):
    return f'<{tag} class="rv {cls}" data-at="{t:.3f}">{content}</{tag}>'


t_ind, t_ing, t_tr, t_rs, t_wk = at("industry"), at("ingredients"), at("treatments"), at("research", 8.0), at("every", 9.5)
t_st, t_hr, t_pa, t_af = at("staying"), at("hours"), at("papers"), at("after")
t_bu, t_ce = at("built"), at("clear", 18.5)
t_on, t_gr, t_fv = at("one", 20.5), at("graded"), at("five")
t_ig, t_tp, t_sc, t_ls = at("ingredient"), at("treatment"), at("skin", 30.0), at("lifestyle")
t_me, t_pr = at("means"), at("practice")
t_so, t_up, t_jo = at("so", 37.0), at("upgrade"), at("join")

scene(1, 0.0, B[1], "pink", f'''
  <div class="eyebrow top">clear evidence</div>
  <div class="mid">
    {rv(0.0, "be honest.", "big")}
    {rv(0.75, "when did you last read a <span class='hl'>research paper</span>?", "sub")}
    <div class="papers">{"".join(rv(1.4 + i * 0.25, "<i></i><i></i><i></i><i></i>", f"sheet s{i}") for i in range(3))}</div>
  </div>''')
scene(2, B[1], B[6], "cream", f'''
  <div class="eyebrow top">the skin industry</div>
  <div class="mid">
    {rv(t_ind - 0.1, "moves fast.", "big")}
    <div class="list">
      {rv(t_ing - 0.05, "<b>i.</b> new ingredients", "li")}
      {rv(t_tr - 0.05, "<b>ii.</b> new treatments", "li")}
      {rv(t_rs - 0.05, "<b>iii.</b> new research", "li")}
    </div>
    {rv(t_wk - 0.05, "every week", "stamp")}
  </div>''')
scene(3, B[6], B[10], "red", f'''
  <div class="eyebrow top">staying current</div>
  <div class="mid">
    {rv(t_st - 0.05, "shouldn't mean", "sub")}
    {rv(t_hr - 0.05, "hours", "huge")}
    {rv(t_pa - 0.05, "searching through papers", "sub")}
    {rv(t_af - 0.05, "after a full day in clinic.", "note")}
  </div>''')
scene(4, B[10], B[11], "cream", f'''
  <div class="mid centre">
    {rv(B[10], "c.", "mark")}
    {rv(t_bu - 0.05, "so i built", "sub")}
    {rv(t_ce - 0.05, "clear evidence.", "big")}
  </div>''')
scene(5, B[11], B[17], "pink", f'''
  <div class="eyebrow top">every week</div>
  <div class="mid">
    <div class="card">
      {rv(t_on - 0.05, "<span>1</span> carefully selected research paper", "row")}
      {rv(t_gr - 0.05, "<span>✓</span> graded for quality", "row")}
      {rv(t_fv - 0.05, "<span>5</span> minute read", "row")}
    </div>
    {rv(t_fv + 0.2, "5:00", "timer")}
  </div>''')
scene(6, B[17], B[20], "cream", f'''
  <div class="eyebrow top">it covers</div>
  <div class="mid">
    <div class="tiles">
      {rv(t_ig - 0.05, "<div class='ti'><svg viewBox='0 0 200 160' width='250' height='200' fill='none' stroke='#f2f0e0' stroke-width='6' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><rect x='40' y='62' width='44' height='80' rx='10'/><path d='M48 62 V48 h28 V62'/><path d='M54 48 V30 q8 -14 16 0 V48'/><path d='M40 100 h44'/><circle cx='140' cy='50' r='12'/><circle cx='172' cy='96' r='12'/><circle cx='120' cy='118' r='12'/><path d='M148 60 L164 86 M160 100 L132 114 M126 106 L136 62'/></svg></div><div class='tl'>ingredient science</div>", "tile")}
      {rv(t_tp - 0.05, "<div class='ti'><svg viewBox='0 0 200 160' width='250' height='200' fill='none' stroke='#f2f0e0' stroke-width='6' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><rect x='52' y='24' width='96' height='124' rx='10'/><rect x='78' y='14' width='44' height='20' rx='6'/><path d='M70 62 l8 8 l14 -16 M104 64 h28 M70 96 l8 8 l14 -16 M104 98 h28 M70 128 h62'/></svg></div><div class='tl'>treatment protocols</div>", "tile")}
      {rv(t_sc - 0.05, "<div class='ti'><svg viewBox='0 0 200 160' width='250' height='200' fill='none' stroke='#f2f0e0' stroke-width='6' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M20 120 q30 -20 60 0 t60 0 t60 0'/><circle cx='56' cy='104' r='5'/><circle cx='104' cy='112' r='4'/><circle cx='150' cy='104' r='5'/><circle cx='96' cy='60' r='34'/><path d='M120 84 L150 114'/></svg></div><div class='tl'>skin conditions</div>", "tile")}
      {rv(t_ls - 0.05, "<div class='ti'><svg viewBox='0 0 200 160' width='250' height='200' fill='none' stroke='#f2f0e0' stroke-width='6' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M30 40 h44 l-6 100 h-32 z'/><path d='M34 80 h36'/><path d='M150 28 a34 34 0 1 0 30 50 a28 28 0 0 1 -30 -50 z'/><path d='M110 140 q0 -40 40 -46 q4 40 -40 46 z M110 140 q14 -20 30 -32'/></svg></div><div class='tl'>lifestyle</div>", "tile")}
    </div>
  </div>''')
scene(7, B[20], B[22], "red", f'''
  <div class="mid centre">
    {rv(B[20], "what it means for", "sub")}
    {rv(t_pr - 0.1, "your practice.", "big")}
  </div>''')
scene(8, B[22], B[23], "red deep", f'''
  <div class="mid centre">
    {rv(B[22], "c.", "mark")}
    {rv(B[22] + 0.15, "your weekly<br>knowledge upgrade.", "big")}
    {rv(t_up, "one paper. five minutes.", "note")}
  </div>''')
scene(9, B[23], TOTAL, "pink", f'''
  <div class="mid centre">
    {rv(B[23], "c.", "mark")}
    {rv(t_jo - 0.05, "join clear evidence.", "big")}
    {rv(t_jo + 0.4, "link in bio", "pill")}
  </div>''')

sfx = [("click-soft", t_ing, 0.15), ("click-soft", t_on, 0.15), ("click-soft", t_ig, 0.15), ("whoosh-short", B[22] - 0.1, 0.18)]
PEAK = {"click-soft": 0.073, "whoosh-short": 0.162}
DUR = {"click-soft": 0.366, "whoosh-short": 0.57}
audio = []
for k, (name, t, vol) in enumerate(sfx):
    s0 = max(0.0, t + 1 / 30 - PEAK[name])
    audio.append(f'<audio id="sfx{k}" class="clip" src="sfx/{name}.mp3" data-start="{s0:.3f}" '
                 f'data-duration="{min(DUR[name], TOTAL - s0 - 0.01):.3f}" data-volume="{vol}" data-track-index="{40 + k}"></audio>')

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
html, body {{ width:1080px; height:1920px; overflow:hidden; background:var(--cream); }}
#root {{ position:relative; width:1080px; height:1920px; overflow:hidden; background:var(--cream); }}
#footage {{ position:absolute; left:0; top:0; width:1080px; height:1920px; opacity:0; }}
.scene {{ position:absolute; inset:0; overflow:hidden; }}
.rv {{ opacity:0; }}
.scene.cream {{ background:var(--cream); color:var(--red); }}
.scene.pink {{ background:var(--pink); color:var(--red); }}
.scene.red {{ background:var(--red); color:var(--cream); }}
.frame {{ position:absolute; inset:28px; border:1.5px solid currentColor; opacity:.35; border-radius:4px; }}
.eyebrow {{ font:600 30px/1 var(--sans); letter-spacing:.24em; text-transform:uppercase; }}
.eyebrow.top {{ position:absolute; top:420px; left:0; right:0; text-align:center; opacity:.85; }}
.mid {{ position:absolute; left:100px; right:100px; top:540px; display:flex; flex-direction:column; gap:34px; }}
.mid.centre {{ align-items:center; text-align:center; top:560px; }}
.big {{ font:900 124px/0.98 var(--serif); letter-spacing:-0.05em; }}
.huge {{ font:italic 900 300px/0.85 var(--serif); letter-spacing:-0.06em; color:var(--pink); }}
.sub {{ font:900 64px/1.08 var(--serif); letter-spacing:-0.04em; }}
.note {{ font:italic 900 48px/1.2 var(--serif); letter-spacing:-0.02em; opacity:.9; }}
.red .note {{ color:var(--pink); }}
.hl {{ background:var(--red); color:var(--pink); padding:0 12px; }}
.mark {{ font:900 170px/1 var(--serif); letter-spacing:-0.05em; }}
.papers {{ position:relative; height:420px; margin-top:20px; }}
.sheet {{ position:absolute; width:300px; height:390px; background:var(--cream); border:2px solid var(--red); border-radius:6px;
  padding:44px 34px; display:flex; flex-direction:column; gap:22px; box-shadow:0 16px 40px rgba(120,20,10,.18); }}
.sheet i {{ display:block; height:12px; background:rgba(174,31,20,.28); border-radius:6px; }}
.sheet i:first-child {{ width:70%; background:var(--red); }}
.sheet.s0 {{ left:120px; top:20px; transform:rotate(-8deg); }}
.sheet.s1 {{ left:300px; top:0; transform:rotate(3deg); }}
.sheet.s2 {{ left:480px; top:30px; transform:rotate(10deg); }}
.list {{ display:flex; flex-direction:column; margin-top:10px; }}
.li {{ font:500 58px/1.2 var(--sans); padding:26px 0; border-bottom:2px solid rgba(174,31,20,.25); }}
.li b {{ display:inline-block; width:100px; font:italic 900 52px var(--serif); color:var(--ink); }}
.stamp {{ align-self:flex-start; margin-top:30px; font:800 56px/1 var(--sans); letter-spacing:.06em; text-transform:uppercase; color:var(--red);
  border:7px solid var(--red); padding:18px 30px; border-radius:6px; transform:rotate(-6deg); }}
.card {{ background:var(--cream); border-radius:8px; padding:20px 50px; box-shadow:0 18px 50px rgba(120,20,10,.18); }}
.row {{ display:flex; align-items:center; gap:30px; font:500 50px/1.2 var(--sans); padding:36px 0; border-bottom:2px solid rgba(174,31,20,.2); }}
.row:last-child {{ border-bottom:none; }}
.row span {{ flex:0 0 96px; height:96px; border-radius:50%; background:var(--red); color:var(--cream); display:grid; place-items:center;
  font:900 54px/1 var(--serif); }}
.timer {{ align-self:center; font:italic 900 180px/1 var(--serif); letter-spacing:-0.05em; }}
.tiles {{ display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:28px; margin-top:40px; }}
.tile {{ background:var(--red); color:var(--cream); border-radius:8px; height:390px; padding:30px 32px; display:flex; flex-direction:column; justify-content:space-between; }}
.ti {{ display:flex; justify-content:center; }}
.tl {{ font:900 54px/1.02 var(--serif); letter-spacing:-0.045em; }}
.pill {{ font:600 46px/1 var(--sans); border:3px solid var(--red); border-radius:999px; padding:24px 54px; }}
#captions {{ position:absolute; inset:0; pointer-events:none; }}
.cap {{ position:absolute; left:80px; right:80px; top:1430px; text-align:center; opacity:0; visibility:hidden; }}
.ct {{ display:inline; font:500 46px/1.6 var(--sans); color:var(--cream); background:var(--ink); padding:8px 22px; border-radius:12px;
  -webkit-box-decoration-break:clone; box-decoration-break:clone; }}
.ct em {{ font:italic 900 50px/1 var(--serif); color:var(--pink); letter-spacing:-0.02em; }}
#seal {{ position:absolute; right:70px; top:1560px; width:76px; height:76px; border-radius:50%; background:var(--red); display:grid; place-items:center;
  box-shadow:0 6px 18px rgba(0,0,0,.18); }}
#seal span {{ font:900 44px/1 var(--serif); color:var(--cream); letter-spacing:-0.05em; padding-bottom:6px; }}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL:.3f}" data-width="1080" data-height="1920">
  <video id="footage" class="clip" src="footage/evidence-step-cut-cool.mp4" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="0"
    playsinline data-has-audio="true"></video>
  {"".join(scenes)}
  <div id="captions" class="clip" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="2" data-track-kind="captions" data-layout-allow-overlap>
    {"".join(cap_html)}
  </div>
  <div id="seal" class="clip" data-start="0" data-duration="{TOTAL:.3f}" data-track-index="3" data-track-kind="graphics"><span>c.</span></div>
  {"".join(audio)}
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});
function enter(host, t) {{
  if (t > 0.01) tl.fromTo(host, {{ clipPath: "inset(0% 0% 100% 0%)" }}, {{ clipPath: "inset(0% 0% 0% 0%)", duration: 0.25, ease: "expo.out", immediateRender: false }}, t);
}}
function cap(sel, s, e) {{
  tl.set(sel, {{ visibility: "visible" }}, s);
  tl.fromTo(sel, {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.2, ease: "power2.out", immediateRender: false }}, s);
  if (e - s > 0.32) tl.to(sel, {{ opacity: 0, duration: 0.08, ease: "power1.in" }}, e - 0.08);
  tl.set(sel, {{ opacity: 0, visibility: "hidden" }}, e);
}}
document.querySelectorAll(".rv").forEach((el) => {{
  const t = Math.max(0, parseFloat(el.dataset.at) - 0.15);
  if (el.classList.contains("stamp")) tl.fromTo(el, {{ opacity: 0, scale: 1.6 }}, {{ opacity: 1, scale: 1, duration: 0.18, ease: "power3.out", immediateRender: false }}, t);
  else if (el.classList.contains("huge") || el.classList.contains("timer")) tl.fromTo(el, {{ opacity: 0, scale: 0.85 }}, {{ opacity: 1, scale: 1, duration: 0.32, ease: "back.out(2)", immediateRender: false }}, t);
  else if (t < 0.05) tl.set(el, {{ opacity: 1 }}, 0);
  else tl.fromTo(el, {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: "power3.out", immediateRender: false }}, t);
}});
{chr(10).join(scene_js)}
{chr(10).join(cap_js)}
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
'''
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(page)
print(f"wrote {OUT.relative_to(ROOT)}: {len(groups)} caption groups, {len(scenes)} scenes, {len(audio)} sfx, duration {TOTAL:.3f}s")
