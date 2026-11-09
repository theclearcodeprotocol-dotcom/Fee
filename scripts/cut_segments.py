"""video-use style cut at full source resolution: per-segment extract (HDR->SDR tonemap + grade
+ 30 ms audio fades), then lossless concat. Keeps 1440x2560 so HyperFrames punch-ins stay sharp."""
import json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path.home() / "Developer/video-use/helpers"))
from render import TONEMAP_CHAIN, is_hdr_source  # reuse video-use's tonemap

CLIP = sys.argv[1] if len(sys.argv) > 1 else "take01"
edit = Path("raw/edit"); seg_dir = edit / "clips_graded" / CLIP; seg_dir.mkdir(parents=True, exist_ok=True)
edl = json.load(open(edit / f"edl_{CLIP}.json"))
paths = []
for i, r in enumerate(edl["ranges"]):
    src = Path(edl["sources"][r["source"]]); dur = r["end"] - r["start"]
    vf = ",".join(([TONEMAP_CHAIN] if is_hdr_source(src) else []) + [edl["grade"]])
    af = f"afade=t=in:st=0:d=0.03,afade=t=out:st={dur-0.03:.3f}:d=0.03"
    out = seg_dir / f"seg_{i:02d}.mp4"; paths.append(out)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{r['start']:.3f}", "-i", str(src), "-t", f"{dur:.3f}",
                    "-vf", vf, "-af", af, "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
                    "-r", "30", "-g", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(out)], check=True)
    print("cut", out.name, f"{dur:.2f}s")
lst = seg_dir / "concat.txt"; lst.write_text("".join(f"file '{p.resolve()}'\n" for p in paths))
Path("assets/footage").mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
                "-movflags", "+faststart", f"assets/footage/{CLIP}-cut.mp4"], check=True)
print(f"wrote assets/footage/{CLIP}-cut.mp4")
