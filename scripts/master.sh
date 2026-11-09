#!/bin/bash
# Two-pass loudnorm to -14 LUFS / -1.5 dBTP (video copied), then a phone copy for GitHub download.
# Usage: scripts/master.sh exports/<name>_render.mp4 exports/<name>.mp4
set -e
in="$1"; out="$2"; phone="${out%.mp4}_phone.mp4"
J=$(ffmpeg -hide_banner -nostats -i "$in" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$J" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -loglevel error -y -i "$in" -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -c:a aac -b:a 192k -movflags +faststart "$out"
ffmpeg -hide_banner -loglevel error -y -i "$out" -c:v libx264 -preset slow -crf 20 -maxrate 6M -bufsize 12M -pix_fmt yuv420p -profile:v high -c:a copy -movflags +faststart "$phone"
# light copy (~18 MB) for phone downloads; audio copied so the master peaks stay intact
ffmpeg -hide_banner -loglevel error -y -i "$out" -c:v libx264 -preset slow -crf 24 -maxrate 2.6M -bufsize 5.2M -pix_fmt yuv420p -profile:v high -c:a copy -movflags +faststart "${out%.mp4}_small.mp4"
ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:)"
ls -la "$out" "$phone"
