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
# Video: lossless concat of the graded segments.
lst = seg_dir / "concat.txt"; lst.write_text("".join(f"file '{p.resolve()}'\n" for p in paths))
vcat = seg_dir / "video_concat.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-map", "0:v",
                "-c", "copy", str(vcat)], check=True)
# Audio: one continuous PCM track, each segment trimmed/padded to exactly its video length, so the
# soundtrack stays frame-locked however a reader handles timestamps (AAC concat drifts up to ~170 ms).
SR = 48000
def vdur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
        "stream=duration", "-of", "csv=p=0", str(p)]).decode().strip())
wavs = []
for i, (r, pth) in enumerate(zip(edl["ranges"], paths)):
    d = vdur(pth); n = round(d * SR)
    w = seg_dir / f"seg_{i:02d}.wav"; wavs.append(w)
    src = Path(edl["sources"][r["source"]])
    af = (f"afade=t=in:st=0:d=0.03,afade=t=out:st={max(0, d - 0.03):.4f}:d=0.03,"
          f"apad=whole_len={n},atrim=end_sample={n}")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{r['start']:.3f}", "-i", str(src), "-t", f"{d:.4f}",
                    "-vn", "-ac", "2", "-ar", str(SR), "-af", af, "-c:a", "pcm_s16le", str(w)], check=True)
alst = seg_dir / "audio_concat.txt"; alst.write_text("".join(f"file '{w.resolve()}'\n" for w in wavs))
awav = seg_dir / "audio.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(alst), "-c", "copy", str(awav)], check=True)
Path("assets/footage").mkdir(parents=True, exist_ok=True)
out = Path(f"assets/footage/{CLIP}-cut.mp4")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(vcat), "-i", str(awav), "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)], check=True)
print(f"wrote {out}  video={vdur(vcat):.3f}s  audio samples={sum(round(vdur(p) * SR) for p in paths)}")
