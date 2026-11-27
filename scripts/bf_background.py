"""Background-only version of the Black Friday reel (laptop on cream, no person, no sound), for the user to
overlay their own clip in Instagram Edits. Built from bf_composite.py.

Original: Black Friday doors-open reel (27 Nov): the user full-frame in their own room (they asked for their real
background, to break up a feed of flat colour blocks), with a laptop floating above their head showing
the website (homepage + Protocol from the 21 Nov iPad recording, course pages and a Clear Evidence
paper from the 27 Nov recording). Same method as newhome_composite.py.

  ~/Developer/video-use/.venv/bin/python scripts/bf_background.py <selfie_multiclass.tflite>

1. Background: pieces of the screen recordings, matched to what's being said, with the phone status
   bar, the admin "View as" bar, the browser bar and the Lovable badge cropped away, stretched to
   each beat's length; the doors/CTA part sits on brand red.
2. Foreground: MediaPipe selfie segmentation of the cut (cooler grade), soft edge, temporal smoothing,
   scaled to 42% in the bottom-right corner. Background shots are stills with a slow push; the
   sneak peek sits on a laptop mock-up.
Writes assets/footage/black-friday-comp.mp4 (audio from the cut, frame count unchanged).
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

segs = json.load(open(FOOT / "black-friday-cut.words.json"))["segments"]
beat_span = {}
for s in segs:
    a, b = beat_span.get(s["beat"], (s["start"], s["end"]))
    beat_span[s["beat"]] = (min(a, s["start"]), max(b, s["end"]))
TOTAL = segs[-1]["end"]

# Everything on a laptop (iPad landscape recording): scroll the homepage and Clear Evidence, a still of the
# Protocol's plan/launch/nurture, the course page as the sneak peek. Prices, the "what's included" list
# (group calls) and the Safari tab bar moments are left out.
SCR = ROOT / "ai-video-editing/black-friday/screen.mp4"
IPAD = SRC / "ipad.mp4"
# (kind, source, t0, t1): never the first 3 s of SCR (Clear Evidence £25/£250 prices) or its Safari-tab moments
PLAN = [("HOOK", [("vid", "ipad", 1.2, 6.0)]),
        ("SETUP", [("vid", "ipad", 8.0, 10.6)]),
        ("PROTOCOL", [("vid", "scr", 32.0, 35.5), ("vid", "scr", 36.5, 44.5)]),
        ("PRICES", [("still", "ipad", 11.6)]),
        ("EVIDENCE", [("vid", "scr", 4.5, 10.5), ("vid", "scr", 18.5, 28.5)]),
        ("CTA", None)]
CROP = {"ipad": (112, 330, 462), "scr": (108, 338, 468)}  # header rows a:b, content from c (admin bar dropped)
SRCS = {"ipad": IPAD, "scr": SCR}
CREAM = np.array((224, 240, 242), np.uint8)  # BGR of #F2F0E0
PAGE = np.array((217, 231, 236), np.uint8)   # site background
SW, SH = 780, 462
LX, LY = (W - SW) // 2, 440


def clean(im, src):  # drop Safari bar and the "view as" admin bar, keep the site header
    a, b, c = CROP[src]
    return np.vstack([im[a:b], im[c:1640]])


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


LMASK = np.zeros((H, W), np.uint8)
cv2.rectangle(LMASK, (LX - 20, LY - 20), (LX + SW + 20, LY + SH + 20), 255, -1)
cv2.fillPoly(LMASK, [np.array([[LX - 60, LY + SH + 20], [LX + SW + 60, LY + SH + 20], [LX + SW + 100, LY + SH + 52], [LX - 100, LY + SH + 52]], np.int32)], 255, cv2.LINE_AA)
LM = (cv2.GaussianBlur(LMASK, (0, 0), 1.0).astype(np.float32) / 255)[..., None]
SHADOW = (cv2.GaussianBlur(np.roll(LMASK, 18, axis=0), (0, 0), 22).astype(np.float32) / 255 * 0.35)[..., None]


def ipad_still(src, t):
    tmpf = FOOT / "bf-still.png"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", str(SRCS[src]), "-frames:v", "1", str(tmpf)], check=True)
    scr = fit(clean(cv2.imread(str(tmpf)), src))
    scr[int(SH * 0.8):] = PAGE  # hide the "What's included" heading under the cards (group calls live there)
    return laptop(scr)


def course():
    ip = cv2.imread(str(SRC / "course-ipad.png"))
    return laptop(fit(np.vstack([ip[118:342], ip[530:1408]])))


tmpd = FOOT / "bf-bg-parts"; tmpd.mkdir(exist_ok=True)
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
            stretch = (b - a) / (sp[3] - sp[2])
            h0, h1, c0 = CROP[sp[1]]
            vf = (f"trim={sp[2]}:{sp[3]},setpts=(PTS-STARTPTS)*{stretch:.5f},fps={FPS},"
                  f"split[x][y];[x]crop=2360:{h1 - h0}:0:{h0}[t];[y]crop=2360:{1640 - c0}:0:{c0}[c];[t][c]vstack,scale={SW}:-2")
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(SRCS[sp[1]]), "-filter_complex", vf, "-an", "-c:v", "libx264",
                            "-crf", "14", "-pix_fmt", "yuv420p", str(out)], check=True)
            shots.append((a, b, "vid", cv2.VideoCapture(str(out))))
        elif sp[0] == "still":
            shots.append((a, b, "img", ipad_still(sp[1], sp[2])))
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


# ---- background only (no person, no sound): for the user to overlay their own clip in Edits
outp = FOOT / "black-friday-bg-only.mp4"
p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-g", "30", "-movflags", "+faststart", str(outp)], stdin=subprocess.PIPE)
n = int(round(TOTAL * FPS))
for i in range(n):
    p.stdin.write(bg_at(i / FPS).tobytes())
p.stdin.close(); p.wait()
print(f"wrote {outp.relative_to(ROOT)}: {n} frames")
