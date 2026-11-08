"""Build edl.json for take01: reorder sections (problem-first hook), drop every gap >= 0.15 s.
Cut edges sit on Scribe word boundaries with 40 ms lead-in / 70 ms tail pads (video-use rules 6-7)."""
import json, sys
from pathlib import Path

edit = Path("raw/edit")
words = [w for w in json.load(open(edit / "transcripts/take01.json"))["words"] if w["type"] == "word"]
SECTIONS = [  # (beat, first word start, last word end) in source seconds
    ("HOOK/PROBLEM", 23.94, 32.66),
    ("WHO IT'S FOR", 0.36, 22.88),
    ("WHAT MEMBERS GET", 33.24, 47.08),
    ("CTA", 47.68, 52.30),
]
GAP, PRE, POST = 0.15, 0.04, 0.07
ranges = []
for beat, a, b in SECTIONS:
    ws = [w for w in words if w["start"] >= a - 0.01 and w["start"] <= b + 0.01]
    run = [ws[0]]
    for prev, w in zip(ws, ws[1:]):
        if w["start"] - prev["end"] >= GAP:
            ranges.append((beat, run)); run = []
        run.append(w)
    ranges.append((beat, run))

# padded spans; merge neighbours when the cut would remove < 0.12 s (a cut that small just jitters)
spans = []
for beat, run in ranges:
    s, e = max(0.0, run[0]["start"] - PRE), run[-1]["end"] + POST
    if spans and spans[-1][0] == beat and s - spans[-1][2] < 0.12:
        spans[-1] = (beat, spans[-1][1], e, spans[-1][3] + run)
    else:
        spans.append((beat, s, e, run))
out, t = [], 0.0
for beat, s, e, run in spans:
    # never overlap the next kept word's lead-in within the same continuous source run
    out.append({"source": "take01", "start": round(s, 3), "end": round(e, 3), "beat": beat,
                "quote": " ".join(w["text"] for w in run), "output_start": round(t, 3)})
    t += e - s
edl = {"version": 1, "sources": {"take01": str(Path("raw/take01.mp4").resolve())},
       "ranges": out, "grade": "eq=contrast=1.04:saturation=1.05:gamma=1.02,colorbalance=rm=0.03:bm=-0.03:rh=0.02:bh=-0.02",
       "overlays": [], "total_duration_s": round(t, 3)}
json.dump(edl, open(edit / "edl.json", "w"), indent=2)
for r in out:
    print(f'{r["output_start"]:6.2f}  [{r["start"]:6.2f}-{r["end"]:6.2f}] {r["beat"][:12]:12} {r["quote"][:70]}')
print(f"segments={len(out)} total={t:.2f}s")
