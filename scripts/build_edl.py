"""Build raw/edit/edl_<clip>.json: chosen takes in story order, drop every gap >= 0.15 s.
Usage: python3 scripts/build_edl.py take02
Cut edges sit on Scribe word boundaries with 40 ms lead-in / 70 ms tail pads (video-use rules 6-7)."""
import json, sys
from pathlib import Path

CLIP = sys.argv[1] if len(sys.argv) > 1 else "take01"
edit = Path("raw/edit")
words = [w for w in json.load(open(edit / f"transcripts/{CLIP}.json"))["words"] if w["type"] == "word"]
CLIPS = {  # (beat, first word start, last word end) in source seconds, in output order
    "take01": [  # Clear Evidence reel: problem-first hook
        ("HOOK/PROBLEM", 23.94, 32.66),
        ("WHO IT'S FOR", 0.36, 22.88),
        ("WHAT MEMBERS GET", 33.24, 47.08),
        ("CTA", 47.68, 52.30),
    ],
    "take02": [  # Four reasons reel: best take of each line, trimmed to ~57 s
        ("HOOK", 0.22, 6.14),
        ("R1 PAYWALLS", 9.86, 10.60), ("R1 PAYWALLS", 17.54, 20.82), ("R1 PAYWALLS", 26.50, 27.84),
        ("R1 PAYWALLS", 35.18, 39.12),
        ("R2 JARGON", 79.58, 83.22), ("R2 JARGON", 87.36, 89.46),
        ("R3 MOVING", 117.00, 119.02), ("R3 MOVING", 149.76, 153.26),
        ("R4 COMMERCIAL", 156.56, 158.60), ("R4 COMMERCIAL", 166.32, 169.62), ("R4 COMMERCIAL", 195.50, 199.70),
        ("SOLUTION", 205.28, 208.24), ("SOLUTION", 227.00, 229.88), ("SOLUTION", 235.56, 237.90),
        ("SOLUTION", 242.66, 245.24), ("SOLUTION", 254.72, 256.96), ("SOLUTION", 261.52, 263.58),
        ("CTA", 278.48, 283.32),
    ],
    "launch-step2": [  # Step 2 of 3: launch. Opens on the strongest line (name = plan vs cost)
        ("HOOK", 20.52, 23.14), ("HOOK", 27.68, 30.74),
        ("SETUP", 3.48, 6.98), ("SETUP", 15.34, 16.66),
        ("EXPLAIN", 43.78, 54.24),
        ("EXISTING", 69.24, 79.12),
        ("NURTURE", 86.30, 87.68), ("NURTURE", 95.50, 97.38),
        ("CTA", 103.04, 104.82), ("CTA", 108.70, 110.32),
    ],
    "plan-step1": [  # Step 1 of 3: plan. Two takes joined (Plan.MOV then "Plan 12/11/26.MOV" from 75.13 s)
        ("HOOK", 13.74, 21.56),
        ("SETUP", 24.04, 31.82),
        ("BODY1", 46.60, 50.56), ("BODY1", 56.58, 67.44),
        ("BODY2", 78.11, 88.35), ("BODY2", 92.03, 93.95),
        ("BODY3", 100.35, 109.11),
        ("CTA", 114.11, 123.01),
    ],
}
SECTIONS = CLIPS[CLIP]
GAP = 0.15
# cut pads (lead-in, tail); take02 is tighter: you lean toward the phone right after your last word
PRE, POST = {"take02": (0.03, 0.04)}.get(CLIP, (0.04, 0.07))
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
    out.append({"source": CLIP, "start": round(s, 3), "end": round(e, 3), "beat": beat,
                "quote": " ".join(w["text"] for w in run), "output_start": round(t, 3)})
    t += e - s
edl = {"version": 1, "sources": {CLIP: str(Path(f"raw/{CLIP}.mp4").resolve())},
       "ranges": out, "grade": "eq=contrast=1.04:saturation=1.05:gamma=1.02,colorbalance=rm=0.03:bm=-0.03:rh=0.02:bh=-0.02"
                 + (",scale=1440:2560:flags=lanczos" if CLIP in ("launch-step2", "plan-step1") else ""),
       "overlays": [], "total_duration_s": round(t, 3)}
json.dump(edl, open(edit / f"edl_{CLIP}.json", "w"), indent=2)
for r in out:
    print(f'{r["output_start"]:6.2f}  [{r["start"]:6.2f}-{r["end"]:6.2f}] {r["beat"][:12]:12} {r["quote"][:70]}')
print(f"segments={len(out)} total={t:.2f}s")
