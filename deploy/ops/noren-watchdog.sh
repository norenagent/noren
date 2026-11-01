#!/usr/bin/env bash
# Noren watchdog. Silent when healthy. Prints (so the cron delivers a message)
# only after TWO consecutive failed runs, which also rides out the planned
# 00:00/12:00 sandbox reset, and once more when things recover.
set -u
STATE=/var/tmp/noren-watchdog.count
UA='Mozilla/5.0'
fails=()

chk() { # name url expected-status
  local code
  code=$(curl -sL -o /dev/null -m25 -A "$UA" -w '%{http_code}' "$2" 2>/dev/null)
  [ "$code" = "$3" ] || fails+=("$1: got ${code:-none}, want $3")
}

chk landing        https://usenoren.xyz/                        200
chk docs           https://docs.usenoren.xyz/x402               200
chk sandbox        https://sandbox.usenoren.xyz/workspace       200
chk gateway-apis   https://gateway.usenoren.xyz/x402/apis       200
chk gateway-402    https://gateway.usenoren.xyz/x402/premium    402

v=$(curl -s -m25 -A "$UA" https://sandbox.usenoren.xyz/api/noren/audit/verify 2>/dev/null)
echo "$v" | grep -q '"valid":true' || fails+=("audit chain is not reporting valid")

for u in oc-landing oc-sandbox-web oc-sandbox-daemon noren-proxy noren-gateway-tunnel; do
  systemctl is-active --quiet "$u" || fails+=("service $u is not active")
done

use=$(df --output=pcent / | tail -1 | tr -dc 0-9)
[ "${use:-0}" -lt "${DISK_LIMIT:-95}" ] || fails+=("disk is ${use}% full")

mounts=$(grep -c noren-docker-workspaces /proc/mounts)
[ "$mounts" -le 2 ] || fails+=("$mounts leftover workspace mounts")

prev=$(cat "$STATE" 2>/dev/null || echo 0)
if [ "${#fails[@]}" -gt 0 ]; then
  n=$((prev + 1)); echo "$n" > "$STATE"
  if [ "$n" -ge 2 ]; then
    echo "NOREN ALERT (${n} checks in a row):"
    printf ' - %s\n' "${fails[@]}"
  fi
else
  [ "$prev" -ge 2 ] && echo "NOREN recovered: all checks pass again."
  echo 0 > "$STATE"
fi
exit 0
