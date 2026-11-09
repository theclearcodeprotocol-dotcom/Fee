"""Map Scribe words onto the cut's timeline using each segment's real (probed) duration.
output_time = word.start - seg.start + seg.offset  (video-use rule 5). Writes assets/footage/<clip>-cut.words.json"""
import json, subprocess, sys
from pathlib import Path
CLIP = sys.argv[1] if len(sys.argv) > 1 else "take01"
edit = Path("raw/edit"); edl = json.load(open(edit / f"edl_{CLIP}.json"))
words = [w for w in json.load(open(edit / f"transcripts/{CLIP}.json"))["words"] if w["type"] == "word"]
def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
        "stream=duration", "-of", "csv=p=0", str(p)]).decode().strip())
off, out, segs = 0.0, [], []
for i, r in enumerate(edl["ranges"]):
    d = dur(edit / f"clips_graded/{CLIP}/seg_{i:02d}.mp4")
    r["output_start"] = round(off, 3); r["output_duration"] = round(d, 3)
    segs.append({"i": i, "start": round(off, 3), "end": round(off + d, 3), "beat": r["beat"]})
    for w in words:
        if w["start"] >= r["start"] - 1e-3 and w["end"] <= r["end"] + 0.08:
            s = w["start"] - r["start"] + off; e = min(w["end"] - r["start"] + off, off + d)
            out.append({"id": f"w{len(out)}", "text": w["text"], "start": round(s, 3), "end": round(e, 3), "seg": i})
    off += d
edl["total_duration_s"] = round(off, 3)
json.dump(edl, open(edit / f"edl_{CLIP}.json", "w"), indent=2)
json.dump({"segments": segs, "words": out}, open(f"assets/footage/{CLIP}-cut.words.json", "w"), indent=1)
print(f"{len(out)} words, {len(segs)} segments, total {off:.3f}s")
print("cut points:", [s["start"] for s in segs[1:]])
