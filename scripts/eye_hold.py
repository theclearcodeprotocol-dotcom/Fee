"""Eye contact fix: find every frame where the eyes drop (lids lowered or shut: blink-glances, looks down)
and replace it with the nearest frame where the eyes are on the lens. The first half of each dip holds
the frame before it, the second half the frame after it, so the mouth jumps as little as possible.
Frame count, timing and audio are untouched, so lip sync stays exact.
Usage: <venv>/python scripts/eye_hold.py <in.mp4> <out.mp4> <face_landmarker.task> [ratio] [--from S] [--to S] [--report]
A frame drops when its lid gap is below `ratio` (default 0.80) x the median gap of the surrounding 3 s."""
import subprocess, sys
import cv2, numpy as np, mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision
src, dst, model = sys.argv[1], sys.argv[2], sys.argv[3]
RATIO = float(sys.argv[4]) if len(sys.argv) > 4 and not sys.argv[4].startswith("--") else 0.80
def arg(name, d):
    return float(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else d
T0, T1 = arg("--from", 0.0), arg("--to", 1e9)
lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=model),
     running_mode=vision.RunningMode.VIDEO, num_faces=1))
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS)
gaps, count = [], 0
while True:
    ok, fr = cap.read()
    if not ok: break
    count += 1; size = fr.shape[:2]
    sm = cv2.resize(fr, (fr.shape[1] // 2, fr.shape[0] // 2))
    r = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(sm, cv2.COLOR_BGR2RGB)), int(count / fps * 1000))
    if r.face_landmarks:
        p = r.face_landmarks[0]; H, W = sm.shape[:2]
        g = ((p[145].y - p[159].y) + (p[374].y - p[386].y)) * H / max(1e-6, (p[133].x - p[33].x + p[263].x - p[362].x) * W)
    else:
        g = 0.0
    gaps.append(g)
g = np.array(gaps); n = len(g); win = int(fps * 1.5)
bad = np.zeros(n, bool)
for i in range(n):
    t = i / fps
    if not (T0 <= t < T1): continue
    ref = np.median(g[max(0, i - win):i + win])
    bad[i] = g[i] < RATIO * ref
# widen each dip by one frame either side (lids start moving before the measure crosses the line)
wide = bad.copy()
for i in np.where(bad)[0]:
    wide[max(0, i - 1):i + 2] = True
runs, i = [], 0
while i < n:
    if wide[i]:
        j = i
        while j + 1 < n and wide[j + 1]: j += 1
        runs.append((i, j)); i = j + 1
    else:
        i += 1
for a, b in runs:
    print(f"dip {a / fps:6.2f}-{(b + 1) / fps:6.2f}s  {b - a + 1} frames  min gap {g[a:b + 1].min():.2f} (normal {np.median(g[max(0, a - win):b + win]):.2f})")
if "--report" in sys.argv: sys.exit(0)
# replacement map: frame k shows source frame src_of[k]; stream so only the held frames sit in memory
src_of = list(range(n))
for a, b in runs:
    before = a - 1 if a > 0 else b + 1
    after = b + 1 if b + 1 < n else before
    mid = (a + b + 1) // 2
    for k in range(a, b + 1):
        src_of[k] = before if k < mid else after
need = set(v for k, v in enumerate(src_of) if v != k)
H, W = size
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", f"{fps}", "-i", "-",
                        "-i", src, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
                        "-g", "30", "-c:a", "copy", "-movflags", "+faststart", dst], stdin=subprocess.PIPE)
cap = cv2.VideoCapture(src); keep, pending = {}, []
for k in range(n):
    ok, fr = cap.read()
    if k in need: keep[k] = fr
    pending.append((k, fr))
    # write every frame whose source is already read
    while pending and src_of[pending[0][0]] <= k:
        kk, f = pending.pop(0)
        v = src_of[kk]
        enc.stdin.write((f if v == kk else keep[v]).tobytes())
enc.stdin.close(); enc.wait()
print(f"wrote {dst}: {n} frames, {len(runs)} dips held, {int(sum(b - a + 1 for a, b in runs))} frames replaced")
