"""Remove a small blemish (a crumb) just outside the screen-right corner of the mouth, frame by frame.

Per frame: MediaPipe face landmarks -> screen-right mouth corner + outer-lip outline -> look for a
small spot (darker or redder than the skin around it) within a few pixels of the corner, outside the
lips -> fill it from the surrounding skin (OpenCV inpaint). Nothing else in the frame is touched.

Run with video-use's venv (has mediapipe + opencv 4.x):
  ~/Developer/video-use/.venv/bin/python scripts/decrumb.py test <video> <out.jpg> t1 t2 ...
  ~/Developer/video-use/.venv/bin/python scripts/decrumb.py run  <in.mp4> <out.mp4>
"""
import subprocess, sys
import cv2, numpy as np
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

MODEL = "/tmp/claude-0/-home-user-Fee/a401bdd6-02e2-5bd3-8112-f561f52de111/scratchpad/face_landmarker.task"
LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
R_SPOT = 15         # search radius around the corner (px at 1080 wide)
MAX_AREA = 70       # anything bigger is not a crumb


def landmarker(video_mode):
    opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODEL),
                                        running_mode=vision.RunningMode.VIDEO if video_mode else vision.RunningMode.IMAGE,
                                        num_faces=1)
    return vision.FaceLandmarker.create_from_options(opts)


def fix(fr, res):
    """Return (patched frame, info) for one frame given its landmark result."""
    if not res.face_landmarks:
        return fr, None
    H, W = fr.shape[:2]
    pts = np.array([(p.x * W, p.y * H) for p in res.face_landmarks[0]])
    a, b = pts[61], pts[291]
    corner, other = (a, b) if a[0] > b[0] else (b, a)        # screen-right corner
    lip_poly = pts[LIPS_OUTER].astype(np.int32)
    out_dir = (corner - other) / (np.linalg.norm(corner - other) + 1e-6)
    centre = corner + out_dir * 5                             # just beyond the corner, in the crease
    cx, cy = int(centre[0]), int(centre[1])
    x0, y0, x1, y1 = max(cx - 40, 0), max(cy - 40, 0), min(cx + 40, W), min(cy + 40, H)
    roi = fr[y0:y1, x0:x1]
    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, A = lab[..., 0], lab[..., 1]
    Lb, Ab = cv2.GaussianBlur(L, (0, 0), 5), cv2.GaussianBlur(A, (0, 0), 5)
    spot = ((Lb - L) > 8) | ((A - Ab) > 5)
    lipmask = np.zeros(roi.shape[:2], np.uint8)
    cv2.fillPoly(lipmask, [lip_poly - [x0, y0]], 1)
    lipmask = cv2.dilate(lipmask, np.ones((5, 5), np.uint8))
    near = np.zeros_like(lipmask)
    cv2.circle(near, (cx - x0, cy - y0), R_SPOT, 1, -1)
    m = (spot & (near > 0) & (lipmask == 0)).astype(np.uint8)
    n, cc, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for j in range(1, n):
        if 2 <= st[j, cv2.CC_STAT_AREA] <= MAX_AREA:
            keep[cc == j] = 1
    info = {"corner": (int(corner[0]), int(corner[1])), "px": int(keep.sum())}
    if not keep.any():
        return fr, info
    keep = cv2.dilate(keep, np.ones((3, 3), np.uint8))
    out = fr.copy()
    out[y0:y1, x0:x1] = cv2.inpaint(roi, keep * 255, 4, cv2.INPAINT_TELEA)
    return out, info


def rgb(fr):
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))


if sys.argv[1] == "test":
    cap = cv2.VideoCapture(sys.argv[2]); fps = cap.get(5); tiles = []
    lm = landmarker(False)
    for t in map(float, sys.argv[4:]):
        cap.set(1, int(t * fps)); ok, fr = cap.read()
        out, info = fix(fr, lm.detect(rgb(fr)))
        if not info:
            continue
        X, Y = info["corner"]
        def z(im):
            return cv2.resize(im[Y - 45:Y + 45, X - 75:X + 45], (360, 270), interpolation=cv2.INTER_CUBIC)
        pair = np.hstack([z(fr), np.full((270, 6, 3), 255, np.uint8), z(out)])
        cv2.putText(pair, f"{t}s  before | after  ({info['px']} px)", (5, 18), 0, 0.5, (0, 255, 255), 1)
        tiles.append(pair)
    cv2.imwrite(sys.argv[3], np.vstack(tiles)); print(len(tiles), "pairs")
else:
    src, dst = sys.argv[2], sys.argv[3]
    cap = cv2.VideoCapture(src); fps = cap.get(5); W, H = int(cap.get(3)), int(cap.get(4))
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", f"{fps}",
                          "-i", "-", "-i", src, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                          "-pix_fmt", "yuv420p", "-g", "30", "-c:a", "copy", "-movflags", "+faststart", dst], stdin=subprocess.PIPE)
    lm = landmarker(True); n = patched = nofaces = 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        res = lm.detect_for_video(rgb(fr), int(n * 1000 / fps))
        out, info = fix(fr, res)
        n += 1; nofaces += info is None; patched += bool(info and info["px"])
        p.stdin.write(out.tobytes())
    p.stdin.close(); p.wait()
    print(f"{n} frames; crumb patched in {patched}; no face found in {nofaces}")
