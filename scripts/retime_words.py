"""Map Scribe words onto the cut's timeline using each segment's real (probed) duration.
output_time = word.start - seg.start + seg.offset  (video-use rule 5). Writes assets/footage/take01-cut.words.json"""
import json, subprocess
from pathlib import Path
edit = Path("raw/edit"); edl = json.load(open(edit / "edl.json"))
words = [w for w in json.load(open(edit / "transcripts/take01.json"))["words"] if w["type"] == "word"]
def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
        "stream=duration", "-of", "csv=p=0", str(p)]).decode().strip())
off, out, segs = 0.0, [], []
for i, r in enumerate(edl["ranges"]):
    d = dur(edit / f"clips_graded/seg_{i:02d}.mp4")
    r["output_start"] = round(off, 3); r["output_duration"] = round(d, 3)
    segs.append({"i": i, "start": round(off, 3), "end": round(off + d, 3), "beat": r["beat"]})
    for w in words:
        if w["start"] >= r["start"] - 1e-3 and w["end"] <= r["end"] + 0.08:
            s = w["start"] - r["start"] + off; e = min(w["end"] - r["start"] + off, off + d)
            out.append({"id": f"w{len(out)}", "text": w["text"], "start": round(s, 3), "end": round(e, 3), "seg": i})
    off += d
edl["total_duration_s"] = round(off, 3)
json.dump(edl, open(edit / "edl.json", "w"), indent=2)
json.dump({"segments": segs, "words": out}, open("assets/footage/take01-cut.words.json", "w"), indent=1)
print(f"{len(out)} words, {len(segs)} segments, total {off:.3f}s")
print("cut points:", [s["start"] for s in segs[1:]])
