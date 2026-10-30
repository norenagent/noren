# Operations files (copies of what runs on the host)

These are the live files, tracked here so changes have history. The host copies are authoritative at runtime.

| File | Installed at | Purpose |
|---|---|---|
| `seed.sh` | `/opt/noren/deploy/seed.sh` | runs after every 12-hour sandbox reset; re-grants `workspace.run` (web-starter, python-run) and `agent.code`, which the reset wipes |
| `oc-sandbox-archive.sh` | `/usr/local/bin/` | archives audit chain, capabilities, receipts, identity and memory to `$HOME/backups/oc-sandbox/` (mode 600, keeps 28) |
| `oc-sandbox-reset.archive.conf` | `/etc/systemd/system/oc-sandbox-reset.service.d/archive.conf` | runs the archive before each reset |
| `noren-watchdog.sh` | `$HOME/scripts/` | every 5 min; alerts only after 2 consecutive failures; checks sites, gateway 402, audit chain, services, disk, leftover mounts |

The archive contains the daemon signing key. Keep the backup directory private.
