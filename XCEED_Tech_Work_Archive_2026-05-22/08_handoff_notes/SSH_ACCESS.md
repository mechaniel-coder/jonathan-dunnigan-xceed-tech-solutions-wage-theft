# SSH Access — Skyhigh / XCEED Tech Server

## SSH Connection
- **Correct SSH IP:** `107.223.74.163` (NOT 76.33.191.130 — SSH is not bound to that interface)
- **User:** `root`
- **Auth:** Key only — password auth disabled (`PasswordAuthentication no`)
- **Key location:** `C:\Users\Jenni\.ssh\skyhigh_ed25519`
- **Connect command:**
  ```
  ssh -i C:\Users\Jenni\.ssh\skyhigh_ed25519 root@107.223.74.163
  ```

## Server Network
- Unraid web UI: `76.33.191.130` ports 8888/8883 (IP-whitelisted via UNRAID-WHITELIST iptables chain)
- SSH listens on: `107.223.74.163` and `107.223.74.164`
- iptables-legacy (not nft)

## IP Whitelist
- Register new home IP via: `https://access.x-ceed.net`
- Whitelist JSON: `/mnt/disk1/appdata/ip-manager/server/data/whitelist.json`
- Rebuilt every minute by cron

## Bots on Server
- `skyhigh-hosting-bot` → `/mnt/disk1/appdata/skyhigh-hosting-bot/` (MariaDB: `skyhigh`)
- `skyhigh-bot` (community) → `/mnt/disk1/appdata/skyhigh-bot/` (MariaDB: `skyhigh_bot`)
