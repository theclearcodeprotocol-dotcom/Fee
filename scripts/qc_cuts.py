"""QC a render at every cut: 5-frame strip (-0.1..+0.1 s) + a 0.3 s waveform around the cut,
plus loudness/true peak and the biggest sample-to-sample jump near each cut (audio pop check).
Usage: python3 scripts/qc_cuts.py exports/<file>.mp4"""
import json, subprocess, sys, array
from pathlib import Path
video = Path(sys.argv[1]); out = Path("raw/edit/verify/qc"); out.mkdir(parents=True, exist_ok=True)
segs = json.load(open("assets/footage/take01-cut.words.json"))["segments"]
cuts = [s["start"] for s in segs[1:]]
sr = 48000
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
                     capture_output=True, check=True).stdout
a = array.array("h", pcm)
def jump(t):  # largest sample-to-sample step within +-15 ms of t, relative to local RMS
    i0, i1 = int((t - 0.015) * sr), int((t + 0.015) * sr)
    w = a[max(i0 - 2400, 0):i1 + 2400]
    rms = (sum(x * x for x in w) / max(len(w), 1)) ** 0.5 or 1
    return max(abs(a[i] - a[i - 1]) for i in range(max(i0, 1), min(i1, len(a)))) / rms
tiles = []
for k, t in enumerate(cuts):
    f = out / f"cut{k:02d}.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t - 0.1:.3f}", "-i", str(video), "-t", "0.2",
                    "-vf", "fps=25,scale=216:-1,tile=5x1", "-frames:v", "1", str(f)], check=True)
    tiles.append(f)
    print(f"cut {k:02d} @ {t:6.3f}s  audio step/RMS = {jump(t):5.2f}")
# one sheet with all cut strips stacked
subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", str(p)] for p in tiles], []),
                "-filter_complex", "".join(f"[{i}:v]" for i in range(len(tiles))) + f"vstack=inputs={len(tiles)}",
                str(out / "all-cuts.jpg")], check=True)
lo = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-af", "ebur128=peak=true", "-f", "null", "-"],
                    capture_output=True, text=True).stderr
print("\n".join(l.strip() for l in lo.splitlines()[-12:] if any(k in l for k in ("I:", "LRA:", "Peak:"))))
print("sheet:", out / "all-cuts.jpg")
