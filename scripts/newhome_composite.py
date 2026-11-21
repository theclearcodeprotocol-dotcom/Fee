"""New site announcement reel: the user cut out of their talking clip and placed over their own
website screen recording ("green screen" without a green screen).

  ~/Developer/video-use/.venv/bin/python scripts/newhome_composite.py <selfie_multiclass.tflite>

1. Background: pieces of the screen recordings, matched to what's being said, with the phone status
   bar, the admin "View as" bar, the browser bar and the Lovable badge cropped away, stretched to
   each beat's length; the doors/CTA part sits on brand red.
2. Foreground: MediaPipe selfie segmentation of the cut (cooler grade), soft edge, temporal smoothing,
   scaled to 72% and anchored bottom-centre.
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

# (beat, source file, source start, source end) — None source = brand red
PLAN = [("HOOK", "screen.mp4", 4.3, 8.0), ("PROTOCOL", "screen.mp4", 9.5, 17.5),
        ("SNEAK", "screen2.mp4", 0.0, 0.9), ("EVIDENCE", "screen.mp4", 24.5, 30.5),
        ("DOORS", None, 0, 0), ("CTA", None, 0, 0)]

# ---- background
tmp = FOOT / "newhome-bg-parts"; tmp.mkdir(exist_ok=True)
parts = []
for i, (beat, src, a, b) in enumerate(PLAN):
    t0, t1 = beat_span[beat]
    if i + 1 < len(PLAN):
        t1 = beat_span[PLAN[i + 1][0]][0]
    else:
        t1 = TOTAL
    dur = t1 - t0
    out = tmp / f"p{i}.mp4"; parts.append(out)
    if src is None:
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=0xAE1F14:s={W}x{H}:r={FPS}:d={dur:.4f}",
               "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(out)]
    else:
        k = dur / (b - a)
        vf = (f"trim={a}:{b},setpts=(PTS-STARTPTS)*{k:.5f},fps={FPS},"
              f"split[x][y];[x]crop=1320:350:0:170[t];[y]crop=1320:1530:0:950[c];[t][c]vstack,"
              f"scale={W}:-2,pad={W}:{H}:0:0:0xF2F0E0")
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(SRC / src), "-filter_complex", vf, "-t", f"{dur:.4f}", "-an",
               "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", str(out)]
    subprocess.run(cmd, check=True)
lst = tmp / "list.txt"; lst.write_text("".join(f"file '{p}'\n" for p in parts))
bg = FOOT / "newhome-bg.mp4"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(bg)], check=True)

# ---- foreground: cooler grade first
cut = FOOT / "newhome-cut-eyes3.mp4"
cool = FOOT / "newhome-cut-cool.mp4"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(cut), "-vf",
                "colorbalance=rs=-0.08:gs=-0.01:bs=0.06:rm=-0.10:gm=-0.01:bm=0.07:rh=-0.05:bh=0.04,eq=saturation=0.82:gamma=1.02,"
                f"scale={W}:{H}", "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "copy", str(cool)], check=True)

seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
    base_options=BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True))
SC = 0.72
# moments the eyes drop to the notes: cut away to the website alone (from DOORS on, a red end page covers it)
HIDE = [(6.25, 6.85)] + [(beat_span["DOORS"][0], TOTAL + 1)]
pw, ph = int(W * SC), int(H * SC)
px, py = (W - pw) // 2, H - ph
cf, cb = cv2.VideoCapture(str(cool)), cv2.VideoCapture(str(bg))
outp = FOOT / "newhome-comp.mp4"
p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                      "-i", str(cool), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p",
                      "-g", "30", "-c:a", "copy", "-movflags", "+faststart", str(outp)], stdin=subprocess.PIPE)
prev, i, last_bg = None, 0, None
while True:
    ok, fr = cf.read()
    if not ok:
        break
    okb, b = cb.read()
    if okb:
        last_bg = b
    b = last_bg.copy()
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
