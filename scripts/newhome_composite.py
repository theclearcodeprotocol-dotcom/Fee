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

# Everything on a laptop (iPad landscape recording): scroll the homepage and Clear Evidence, a still of the
# Protocol's plan/launch/nurture, the course page as the sneak peek. Prices, the "what's included" list
# (group calls) and the Safari tab bar moments are left out.
PLAN = [("HOOK", [("vid", 1.2, 6.0)]),
        ("PROTOCOL", [("vid", 8.0, 10.6), ("still", 11.6)]),
        ("SNEAK", [("course",)]),
        ("EVIDENCE", [("vid", 29.0, 40.0)]),
        ("DOORS", None), ("CTA", None)]
CREAM = np.array((224, 240, 242), np.uint8)  # BGR of #F2F0E0
PAGE = np.array((217, 231, 236), np.uint8)   # site background
SW, SH = 940, 556
LX, LY = (W - SW) // 2, 520
IPAD = SRC / "ipad.mp4"


def clean_ipad(im):  # drop Safari bar and the "view as" admin bar, keep the site header
    return np.vstack([im[112:330], im[462:1640]])


def fit(scr):
    out = np.empty((SH, SW, 3), np.uint8); out[:] = PAGE
    r = cv2.resize(scr, (SW, int(scr.shape[0] * SW / scr.shape[1])), interpolation=cv2.INTER_AREA)
    h = min(SH, r.shape[0]); out[:h] = r[:h]
    return out


def laptop(screen):
    c = np.empty((H, W, 3), np.uint8); c[:] = CREAM
    cv2.rectangle(c, (LX - 20, LY - 20), (LX + SW + 20, LY + SH + 20), (19, 20, 29), -1, cv2.LINE_AA)
    c[LY:LY + SH, LX:LX + SW] = screen
    base = np.array([[LX - 60, LY + SH + 20], [LX + SW + 60, LY + SH + 20], [LX + SW + 100, LY + SH + 52], [LX - 100, LY + SH + 52]], np.int32)
    cv2.fillPoly(c, [base], (150, 156, 168), cv2.LINE_AA)
    cv2.rectangle(c, (W // 2 - 70, LY + SH + 20), (W // 2 + 70, LY + SH + 30), (110, 116, 128), -1)
    return c


def ipad_still(t):
    tmpf = FOOT / "newhome-still.png"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", str(IPAD), "-frames:v", "1", str(tmpf)], check=True)
    return laptop(fit(clean_ipad(cv2.imread(str(tmpf)))))


def course():
    ip = cv2.imread(str(SRC / "course-ipad.png"))
    return laptop(fit(np.vstack([ip[118:342], ip[530:1408]])))


tmpd = FOOT / "newhome-bg-parts"; tmpd.mkdir(exist_ok=True)
shots = []  # (t0, t1, kind, payload)
for i, (beat, spec) in enumerate(PLAN):
    t0 = beat_span[beat][0]
    t1 = beat_span[PLAN[i + 1][0]][0] if i + 1 < len(PLAN) else TOTAL
    if spec is None:
        shots.append((t0, t1, "red", None)); continue
    n = len(spec)
    for k, sp in enumerate(spec):
        a, b = t0 + (t1 - t0) * k / n, t0 + (t1 - t0) * (k + 1) / n
        if sp[0] == "vid":
            out = tmpd / f"v{i}_{k}.mp4"
            stretch = (b - a) / (sp[2] - sp[1])
            vf = (f"trim={sp[1]}:{sp[2]},setpts=(PTS-STARTPTS)*{stretch:.5f},fps={FPS},"
                  f"split[x][y];[x]crop=2360:218:0:112[t];[y]crop=2360:1178:0:462[c];[t][c]vstack,scale={SW}:-2")
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(IPAD), "-filter_complex", vf, "-an", "-c:v", "libx264",
                            "-crf", "14", "-pix_fmt", "yuv420p", str(out)], check=True)
            shots.append((a, b, "vid", cv2.VideoCapture(str(out))))
        elif sp[0] == "still":
            shots.append((a, b, "img", ipad_still(sp[1])))
        else:
            shots.append((a, b, "img", course()))
RED_IMG = np.empty((H, W, 3), np.uint8); RED_IMG[:] = RED
_last = {}


def bg_at(t):
    for a, b, kind, pl in shots:
        if a <= t < b:
            if kind == "red":
                return RED_IMG.copy()
            if kind == "img":
                return pl.copy()
            ok, fr = pl.read()
            if ok:
                _last[id(pl)] = laptop(fit_frame(fr))
            return _last[id(pl)].copy()
    return RED_IMG.copy()


def fit_frame(fr):
    out = np.empty((SH, SW, 3), np.uint8); out[:] = PAGE
    h = min(SH, fr.shape[0]); out[:h] = fr[:h]
    return out


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
