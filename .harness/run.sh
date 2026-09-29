#!/usr/bin/env bash
# `!run <card>`: the app from this worktree on free ports (3100 upward), in the background.
# Prints the URLs. Output goes to /tmp/jeffardy-<slug>.log, the pid to /tmp/jeffardy-<slug>.pid.
set -euo pipefail
WT="${HARNESS_WORKTREE:-$PWD}"
cd "$WT"
slug="${HARNESS_CARD:-$(basename "$WT")}"
slug="${slug//[^A-Za-z0-9._-]/-}"
LOG="/tmp/jeffardy-$slug.log"
PIDFILE="/tmp/jeffardy-$slug.pid"
[[ -d node_modules ]] || bash .harness/hooks/pre-pickup.sh
if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill -- -"$(cat "$PIDFILE")" 2>/dev/null || kill "$(cat "$PIDFILE")" 2>/dev/null || true
  sleep 1
fi
port_free() { ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
port=3100
while ! port_free "$port" || ! port_free $((port + 1)); do port=$((port + 2)); done
tv=$((port + 1))
PORT=$port TV_PORT=$tv setsid npm run dev >"$LOG" 2>&1 &
echo $! >"$PIDFILE"
for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://127.0.0.1:$port/" && break
  sleep 1
done
echo "host: http://localhost:$port  tv: http://localhost:$tv  (log $LOG)"
