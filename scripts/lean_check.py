"""Find leans/reaches toward the phone: track the face (size + position) through a cut and flag
segment edges where the face grows or shifts versus that segment's settled middle.
Usage: python3 scripts/lean_check.py <clip>"""
import json, sys, statistics, cv2
from pathlib import Path
clip = sys.argv[1]
casc = cv2.CascadeClassifier(str(Path(sys.argv[2]) if len(sys.argv) > 2 else
    Path("/tmp/claude-0/-home-user-Fee/a401bdd6-02e2-5bd3-8112-f561f52de111/scratchpad/ocv4/data/haarcascades/haarcascade_frontalface_default.xml")))
segs = json.load(open(f"assets/footage/{clip}-cut.words.json"))["segments"]
cap = cv2.VideoCapture(f"assets/footage/{clip}-cut.mp4"); fps = cap.get(cv2.CAP_PROP_FPS)
track, i = [], 0
while True:
    ok, fr = cap.read()
    if not ok: break
    if i % 2 == 0:
        g = cv2.cvtColor(cv2.resize(fr, (360, 640)), cv2.COLOR_BGR2GRAY)
        f = casc.detectMultiScale(g, 1.1, 5, minSize=(60, 60))
        if len(f):
            x, y, w, h = max(f, key=lambda r: r[2] * r[3])
            track.append((i / fps, float(x + w / 2) * 3, float(y + h / 2) * 3, float(w) * 3))
    i += 1
json.dump(track, open(f"raw/edit/verify/face_{clip}.json", "w"))
flags = []
for s in segs:
    a, b = s["start"], s["end"]; L = b - a
    mid = [p for p in track if a + L * 0.3 <= p[0] <= b - L * 0.3] or [p for p in track if a <= p[0] <= b]
    if not mid: continue
    mw, mx, my = (statistics.median(p[k] for p in mid) for k in (3, 1, 2))
    def dev(p): return max(abs(p[3] / mw - 1) * 100, abs(p[1] - mx) / mw * 100, abs(p[2] - my) / mw * 100)
    for edge, win in (("start", (a, a + 0.8)), ("end", (b - 0.8, b))):
        pts = [p for p in track if win[0] <= p[0] <= win[1]]
        if not pts: continue
        worst = max(pts, key=dev)
        flag = dev(worst) > 12
        if flag: flags.append((s["i"], edge, worst[0], dev(worst)))
        print(f"seg {s['i']:02d} {edge:5} worst {dev(worst):5.1f}% at {worst[0]:6.2f}s {'<-- LEAN' if flag else ''}")
print("flagged:", [(f"seg{i}", e, round(t, 2)) for i, e, t, _ in flags])
