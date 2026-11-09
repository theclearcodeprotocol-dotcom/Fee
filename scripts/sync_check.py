"""Lip-sync check: compare a video's audio with the raw source's audio at the matching source time
for several segments of the EDL. Offsets should be within +-1 frame (33 ms).
Usage: python3 scripts/sync_check.py <video> <clip>"""
import json, subprocess, sys
import numpy as np
video, clip = sys.argv[1], sys.argv[2]
edl = json.load(open(f"raw/edit/edl_{clip}.json")); src = edl["sources"][clip]
def pcm(p, t, d=0.8, sr=8000):
    b = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-t", f"{d}", "-i", p, "-ac", "1", "-ar", str(sr),
                        "-f", "s16le", "-"], capture_output=True).stdout
    return np.frombuffer(b, dtype=np.int16).astype(float)
worst = 0
rs = edl["ranges"]; pick = sorted(set([0, len(rs) // 4, len(rs) // 2, 3 * len(rs) // 4, len(rs) - 1]))
for i in pick:
    r = rs[i]; d = min(0.8, r["output_duration"] - 0.1)
    a = pcm(src, r["start"] + 0.05, d); b = pcm(video, r["output_start"] + 0.05, d)
    n = min(len(a), len(b)); c = np.correlate(b[:n] - b[:n].mean(), a[:n] - a[:n].mean(), "full")
    ms = (np.argmax(c) - (n - 1)) / 8; worst = max(worst, abs(ms))
    print(f"seg {i:02d} @ {r['output_start']:6.2f}s  offset {ms:+6.1f} ms")
print("SYNC OK" if worst <= 34 else f"SYNC OFF (worst {worst:.0f} ms)")
