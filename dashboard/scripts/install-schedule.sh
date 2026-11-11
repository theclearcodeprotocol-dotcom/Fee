#!/usr/bin/env bash
# Install the dashboard's timed jobs into your user crontab (your machine's local time).
#
#   scripts/install-schedule.sh           # install / update
#   scripts/install-schedule.sh --print   # show the lines without installing
#   scripts/install-schedule.sh --remove  # take them out again
#
#   06:40 daily     trending:fetch       12 sources, tagged
#   07:00 daily     trending:slack       top 5 hook-worthy items to slack
#
# Analytics, competitors and posting go through Metricool, which Claude reaches
# with `/metricool` (see CLAUDE.md) — no extra subscriptions. Paid alternatives:
#   --apify   also install the Sunday 06:00 Apify competitor scrape (needs APIFY_TOKEN)
#   --direct  also install analytics:fetch (05:30) and publish:due (5 min) for the
#             direct Instagram/TikTok APIs
#
# The machine has to be awake at those times (cron doesn't catch up after sleep).
# Logs go to dashboard/logs/. Secrets are read from dashboard/.env.local.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BEGIN="# >>> clear-code-dashboard >>>"
END="# <<< clear-code-dashboard <<<"
RUN="cd \"$DIR\" && PATH=\"$PATH\" npm run -s"

DIRECT=0
APIFY=0
for a in "$@"; do
  [ "$a" = "--direct" ] && DIRECT=1
  [ "$a" = "--apify" ] && APIFY=1
done

block() {
  echo "$BEGIN"
  echo "40 6 * * *  $RUN trending:fetch     >> \"$DIR/logs/trending.log\" 2>&1"
  echo "0 7 * * *   $RUN trending:slack     >> \"$DIR/logs/slack.log\" 2>&1"
  if [ "$APIFY" = 1 ]; then
    echo "0 6 * * 0   $RUN scrape:competitors >> \"$DIR/logs/competitors.log\" 2>&1"
  fi
  if [ "$DIRECT" = 1 ]; then
    echo "30 5 * * *  $RUN analytics:fetch    >> \"$DIR/logs/analytics.log\" 2>&1"
    echo "*/5 * * * * $RUN publish:due        >> \"$DIR/logs/publish.log\" 2>&1"
  fi
  echo "$END"
}

current="$(crontab -l 2>/dev/null || true)"
without="$(printf '%s\n' "$current" | sed "/^$BEGIN\$/,/^$END\$/d")"

case "${1:-}" in
  --print) block ;;
  --remove)
    printf '%s\n' "$without" | crontab -
    echo "removed the dashboard jobs from your crontab"
    ;;
  *)
    mkdir -p "$DIR/logs"
    { [ -n "$without" ] && printf '%s\n' "$without"; block; } | crontab -
    echo "installed (local time, $(date +%Z)):"
    block
    ;;
esac
