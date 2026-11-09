"""Find every stretch where the speaker leans toward the camera (face >10% closer than normal for >=0.3 s)
that is NOT already hidden by a full-frame page in the composition.
Run with video-use's venv (mediapipe):
  ~/Developer/video-use/.venv/bin/python scripts/lean_scan.py <cut.mp4> <clip> [edits/<name>/index.html]"""
import json, re, sys
import cv2, numpy as np, mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision
video, clip = sys.argv[1], sys.argv[2]
comp = sys.argv[3] if len(sys.argv) > 3 else None
MODEL = "/tmp/claude-0/-home-user-Fee/a401bdd6-02e2-5bd3-8112-f561f52de111/scratchpad/face_landmarker.task"
lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=1))
cap = cv2.VideoCapture(video); fps = cap.get(5); i = 0; T, S = [], []
while True:
    ok, fr = cap.read()
    if not ok: break
    if i % 2 == 0:
        H, W = fr.shape[:2]
        r = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)), int(i * 1000 / fps))
        if r.face_landmarks:
            p = r.face_landmarks[0]; T.append(i / fps); S.append(np.hypot((p[33].x - p[263].x) * W, (p[33].y - p[263].y) * H))
    i += 1
S = np.convolve(np.array(S), np.ones(5) / 5, "same"); base = np.median(S)
covered = []
if comp:
    h = open(comp).read()
    covered = [(float(a), float(a) + float(b)) for a, b in
               re.findall(r'class="clip pop (?:page|covercard)[^"]*" data-start="([\d.]+)" data-duration="([\d.]+)"', h)]
words = json.load(open(f"assets/footage/{clip}-cut.words.json"))["words"]
ev, cur = [], None
for t, s in zip(T, S):
    if s > base * 1.10 and not any(a - 0.05 <= t <= b + 0.05 for a, b in covered):
        if cur and t - cur[1] <= 0.25: cur[1] = t; cur[2] = max(cur[2], s / base)
        else:
            if cur: ev.append(cur)
            cur = [t, t, s / base]
if cur: ev.append(cur)
ev = [e for e in ev if e[1] - e[0] >= 0.3]
for a, b, m in ev:
    print(f"LEAN {a:6.2f}-{b:6.2f}s face x{m:.2f}: " + " ".join(w["text"] for w in words if w["end"] > a and w["start"] < b))
print("no uncovered leans" if not ev else f"{len(ev)} uncovered lean(s)")
