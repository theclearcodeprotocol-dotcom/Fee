"""New site announcement reel: the user cut out of their talking clip and placed over their own
website screen recording ("green screen" without a green screen).

  ~/Developer/video-use/.venv/bin/python scripts/newhome_composite.py <selfie_multiclass.tflite>

1. Background: pieces of the screen recordings, matched to what's being said, with the phone status
   bar, the admin "View as" bar, the browser bar and the Lovable badge cropped away, stretched to
   each beat's length; the doors/CTA part sits on brand red.
2. Foreground: MediaPipe selfie segmentation of the cut (cooler grade), soft edge, temporal smoothing,
   scaled to 42% in the bottom-right corner. Background shots are stills with a slow push; the
   sneak peek sits on a laptop mock-up.
Writes assets/footage/newhome-comp.mp4 (audio from the cut, frame count unchanged).
"""
import json, subprocess, sys
from pathlib import Path
import cv2, numpy as np, mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

ROOT = Path(__file__).resolve().parent.parent
FOOT = ROOT / "assets/footage"
SRC = ROOT / "ai-video-editing/new-home"
MODEL = sys.argv[1]
W, H, FPS = 1080, 1920, 30
RED = (20, 31, 174)  # BGR

segs = json.load(open(FOOT / "newhome-cut.words.json"))["segments"]
beat_span = {}
for s in segs:
    a, b = beat_span.get(s["beat"], (s["start"], s["end"]))
    beat_span[s["beat"]] = (min(a, s["start"]), max(b, s["end"]))
TOTAL = segs[-1]["end"]

# Stills (no constant scrolling): (beat, [(source, time), ...]); the sneak peek goes on a laptop mock-up.
PLAN = [("HOOK", [("screen.mp4", 6.5)]), ("PROTOCOL", [("screen.mp4", 10.3), ("screen.mp4", 11.5)]),
        ("SNEAK", "laptop"), ("EVIDENCE", [("screen.mp4", 21.3), ("screen.mp4", 26.0)]), ("DOORS", None), ("CTA", None)]
CREAM = np.array((224, 240, 242), np.uint8)  # BGR of #F2F0E0


def still(src, t):
    tmpf = FOOT / "newhome-still.png"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", str(SRC / src), "-frames:v", "1", str(tmpf)], check=True)
    im = cv2.imread(str(tmpf))
    im = np.vstack([im[170:520], im[950:2480]])  # drop status bar, admin bar, browser bar and badge
    return im


def page(im):  # website still at full width on cream
    s = cv2.resize(im, (W, int(im.shape[0] * W / im.shape[1])), interpolation=cv2.INTER_AREA)
    c = np.empty((H, W, 3), np.uint8); c[:] = CREAM
    h = min(H, s.shape[0]); c[:h] = s[:h]
    return c


def laptop(im):
    c = np.empty((H, W, 3), np.uint8); c[:] = CREAM
    sw, sh = 880, 550
    x0, y0 = (W - sw) // 2, 600
    cv2.rectangle(c, (x0 - 22, y0 - 22), (x0 + sw + 22, y0 + sh + 22), (19, 20, 29), -1, cv2.LINE_AA)
    scr = im[0:int(1320 * sh / sw)]
    c[y0:y0 + sh, x0:x0 + sw] = cv2.resize(scr, (sw, sh), interpolation=cv2.INTER_AREA)
    base = np.array([[x0 - 90, y0 + sh + 22], [x0 + sw + 90, y0 + sh + 22], [x0 + sw + 130, y0 + sh + 58], [x0 - 130, y0 + sh + 58]], np.int32)
    cv2.fillPoly(c, [base], (150, 156, 168), cv2.LINE_AA)
    cv2.rectangle(c, (W // 2 - 70, y0 + sh + 22), (W // 2 + 70, y0 + sh + 32), (110, 116, 128), -1)
    return c


shots = []  # (t0, t1, base image or None)
for i, (beat, spec) in enumerate(PLAN):
    t0 = beat_span[beat][0]
    t1 = beat_span[PLAN[i + 1][0]][0] if i + 1 < len(PLAN) else TOTAL
    if spec is None:
        shots.append((t0, t1, None))
    elif spec == "laptop":
        shots.append((t0, t1, laptop(still("screen2.mp4", 0.2))))
    else:
        n = len(spec)
        for k, (src, t) in enumerate(spec):
            shots.append((t0 + (t1 - t0) * k / n, t0 + (t1 - t0) * (k + 1) / n, page(still(src, t))))
RED_IMG = np.empty((H, W, 3), np.uint8); RED_IMG[:] = RED


def bg_at(t):
    for a, b, im in shots:
        if a <= t < b:
            if im is None:
                return RED_IMG.copy()
            z = 1.0 + 0.04 * (t - a) / max(0.01, b - a)  # slow push, no scrolling
            m = cv2.getRotationMatrix2D((W / 2, H * 0.3), 0, z)
            return cv2.warpAffine(im, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return RED_IMG.copy()


# ---- foreground: cooler grade first
cut = FOOT / "newhome-cut-eyes3.mp4"
cool = FOOT / "newhome-cut-cool.mp4"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(cut), "-vf",
                "colorbalance=rs=-0.08:gs=-0.01:bs=0.06:rm=-0.10:gm=-0.01:bm=0.07:rh=-0.05:bh=0.04,eq=saturation=0.82:gamma=1.02,"
                f"scale={W}:{H}", "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "copy", str(cool)], check=True)

seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
    base_options=BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True))
SC = 0.42
# moments the eyes drop to the notes: cut away to the website alone (from DOORS on, a red end page covers it)
HIDE = [(beat_span["DOORS"][0], TOTAL + 1)]  # red end page from the doors line on
pw, ph = int(W * SC), int(H * SC)
px, py = W - pw - 24, H - ph
cf = cv2.VideoCapture(str(cool))
outp = FOOT / "newhome-comp.mp4"
p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-i", str(cool), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
                      "-g", "30", "-c:a", "copy", "-movflags", "+faststart", str(outp)], stdin=subprocess.PIPE)
prev, i, last_bg = None, 0, None
while True:
    ok, fr = cf.read()
    if not ok:
        break
    b = bg_at(i / FPS)
    r = seg.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)), int(i * 1000 / FPS))
    a = 1.0 - r.confidence_masks[0].numpy_view().astype(np.float32)
    a = cv2.resize(a, (W, H))
    if prev is not None:
        a = 0.6 * a + 0.4 * prev
    prev = a
    a = np.clip((a - 0.15) / 0.7, 0, 1)
    a = cv2.GaussianBlur(a, (0, 0), 2.5)
    t = i / FPS
    if any(h0 <= t < h1 for h0, h1 in HIDE):
        p.stdin.write(b.tobytes()); i += 1; continue
    small = cv2.resize(fr, (pw, ph), interpolation=cv2.INTER_AREA)
    sa = cv2.resize(a, (pw, ph))[..., None]
    roi = b[py:py + ph, px:px + pw].astype(np.float32)
    b[py:py + ph, px:px + pw] = (small * sa + roi * (1 - sa)).astype(np.uint8)
    p.stdin.write(b.tobytes()); i += 1
p.stdin.close(); p.wait()
print(f"wrote {outp.relative_to(ROOT)}: {i} frames, beats {beat_span}")
