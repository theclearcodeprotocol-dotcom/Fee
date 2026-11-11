"""Eye-contact scan: flag stretches of a cut where the speaker looks away from the lens.
Measures, at 10 fps, head yaw/pitch (MediaPipe face transform) and iris position inside each eye,
relative to the clip's own median (the median frame is taken as "looking at the lens").
Usage: <venv>/python scripts/gaze_scan.py assets/footage/<clip>-cut.mp4 <face_landmarker.task> [threshold]
Prints a per-0.1 s score and the stretches over the threshold, with the cut segments they fall in."""
import json, math, sys
import cv2, numpy as np
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

video, model = sys.argv[1], sys.argv[2]
THR = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=model), running_mode=vision.RunningMode.VIDEO,
                                    output_facial_transformation_matrixes=True, num_faces=1)
lm = vision.FaceLandmarker.create_from_options(opts)
cap = cv2.VideoCapture(video); fps = cap.get(cv2.CAP_PROP_FPS); step = max(1, round(fps / 10))
rows, i, gaps = [], 0, []
while True:
    ok, fr = cap.read()
    if not ok: break
    if i % step == 0:
        small = cv2.resize(fr, (fr.shape[1] // 2, fr.shape[0] // 2))
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
        r = lm.detect_for_video(img, int(i / fps * 1000))
        t = i / fps
        if r.face_landmarks:
            p = r.face_landmarks[0]; m = np.array(r.facial_transformation_matrixes[0])
            yaw = math.degrees(math.atan2(-m[2, 0], math.hypot(m[2, 1], m[2, 2])))
            pitch = math.degrees(math.atan2(m[2, 1], m[2, 2]))
            def eye(a, b, up, lo, iris):
                ax, bx = p[a].x, p[b].x; h = (p[iris].x - ax) / (bx - ax)
                v = (p[iris].y - p[up].y) / max(1e-6, p[lo].y - p[up].y)
                return h, v
            h1, v1 = eye(33, 133, 159, 145, 468); h2, v2 = eye(362, 263, 386, 374, 473)
            gap = ((p[145].y - p[159].y) + (p[374].y - p[386].y)) / max(1e-6, (p[133].x - p[33].x) + (p[263].x - p[362].x))
            if gap < 0.12:  # lids nearly shut: a blink, or eyes lowered (looking down) if it lasts
                v1 = v2 = None
            rows.append((t, yaw, pitch, (h1 + h2) / 2, None if v1 is None else (v1 + v2) / 2))
            gaps.append((t, gap))
        else:
            rows.append((t, None, None, None, None))
    i += 1
good = np.array([r[1:] for r in rows if r[1] is not None and r[4] is not None])
med = np.median(good, 0); mad = np.median(np.abs(good - med), 0) * 1.4826 + np.array([1.5, 1.5, 0.02, 0.04])
# score: worst normalised deviation, head angles in degrees over 8°, iris over 3 robust SDs
scores = []
for t, *v in rows:
    if v[0] is None: scores.append((t, 9.0, "no face")); continue
    if v[3] is None:
        # lids low for over 0.3 s is eyes lowered, not a blink
        near = [g for tt, g in gaps if abs(tt - t) <= 0.2]
        low = sum(1 for g in near if g < 0.12) >= 4
        scores.append((t, 2.0 if low else 0.0, "eyes-down" if low else "blink")); continue
    d = np.abs(np.array(v) - med)
    parts = {"yaw": d[0] / 8, "pitch": d[1] / 8, "iris-h": d[2] / (3 * mad[2]), "iris-v": d[3] / (3 * mad[3])}
    k = max(parts, key=parts.get); scores.append((t, parts[k], k))
segs = None
try:
    segs = json.load(open(video.replace(".mp4", ".words.json").replace("-clean", "")))["segments"]
except Exception:
    pass
if "--gaps" in sys.argv:
    print(" ".join(f"{t:.1f}:{g:.2f}" for t, g in gaps[::2]))
if "--trace" in sys.argv:
    for t, sc, k in scores[::5]: print(f"  {t:6.2f} {sc:4.1f} {k}")
runs, cur = [], None
for t, s, k in scores:
    if s > THR:
        if cur and t - cur[1] <= 0.25: cur[1] = t; cur[2].add(k); cur[3] = max(cur[3], s)
        else:
            cur = [t, t, {k}, s]; runs.append(cur)
print(f"median yaw {med[0]:.1f} pitch {med[1]:.1f} iris h {med[2]:.3f} v {med[3]:.3f}")
for a, b, ks, mx in runs:
    if b - a < 0.15: continue
    seg = [x["i"] for x in segs if x["start"] <= a < x["end"]][0] if segs else "-"
    print(f"{a:6.2f}-{b + 0.1:6.2f}s  seg {seg}  worst {mx:4.1f}  {'/'.join(sorted(ks))}")
