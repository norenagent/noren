#!/bin/sh
# Archive the sandbox audit chain and capability log before a reset wipes them.
# The public sandbox resets every 12 hours by design; this keeps a tamper-evident
# copy of what happened. Silent on success, prints only on failure. Keeps 28.
SRC=/var/lib/oc-sandbox
DEST=$HOME/backups/oc-sandbox
STAMP=$(date -u +%Y%m%d_%H%M%S)
mkdir -p "$DEST" || { echo "oc-sandbox archive FAILED: cannot create $DEST"; exit 0; }
OUT="$DEST/state_$STAMP.tar.gz"
# identity/ holds the daemon signing key, so the archive is private (mode 600).
tar -czf "$OUT" -C "$SRC" audit capabilities receipts identity memory.db 2>/dev/null
if [ ! -s "$OUT" ]; then
  rm -f "$OUT"
  echo "oc-sandbox archive FAILED: empty archive from $SRC"
  exit 0
fi
chmod 600 "$OUT"
ls -1t "$DEST"/state_*.tar.gz 2>/dev/null | tail -n +29 | while read f; do rm -f "$f"; done
exit 0
