#!/usr/bin/env bash
# A fresh card worktree: dependencies and the gitignored local files, from the human's checkout.
# node_modules is a reflink copy on btrfs (instant, no extra disk until something changes);
# npm install only runs if package-lock.json differs from the checkout's.
set -euo pipefail
WT="${HARNESS_WORKTREE:-$PWD}"
MAIN="$HOME/Projects/jeffardy"
cd "$WT"
if [[ ! -e node_modules && -d "$MAIN/node_modules" ]]; then
  cp -a --reflink=auto "$MAIN/node_modules" node_modules
  echo "pre-pickup: node_modules cloned from $MAIN"
fi
if ! cmp -s package-lock.json "$MAIN/package-lock.json" || [[ ! -d node_modules ]]; then
  echo "pre-pickup: package-lock differs, npm install"
  npm install --no-audit --no-fund --prefer-offline
fi
[[ -f .env.local || ! -f "$MAIN/.env.local" ]] || cp "$MAIN/.env.local" .env.local
# A consistent copy of the live database (it runs in WAL mode).
if [[ ! -f jeopardy.db && -f "$MAIN/jeopardy.db" ]]; then
  sqlite3 "$MAIN/jeopardy.db" ".backup '$WT/jeopardy.db'" 2>/dev/null || cp "$MAIN/jeopardy.db" jeopardy.db
fi
echo "pre-pickup: ready"
