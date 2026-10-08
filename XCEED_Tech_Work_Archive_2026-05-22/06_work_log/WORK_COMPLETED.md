# Work Completed Log — XCEED Tech
**Period:** Current engagement  
**Engineer:** GitHub Copilot / DevOps assistant  
**Server:** Unraid at x-ceed.net

---

## Session 1 — Infrastructure Assessment & Port Security

### Completed
- Audited all running Docker containers and exposed ports
- Identified Unraid web UI (8888/8883) exposed to internet
- Verified Apache/WordPress on port 80 is independent of Nginx/NPM
- Blocked ports 8888/8883 via iptables-legacy INPUT chain (static admin IP + subnet)
- Locked MariaDB ports 3306/3307 via DOCKER-USER chain
- Locked admin-only ports: 81, 8080, 8025, 3002, 53135, 4190
- Verified iptables rules survive Docker restart (DOCKER-USER chain approach)
- Persisted all rules to /boot/config/go

---

## Session 2 — Dynamic IP Whitelist System (ip-manager)

### Problem
Employees have dynamic home IPs. Static whitelist not feasible. Need authenticated IP registration.

### Solution Built
**ip-manager** — Node.js Express server that:
1. Accepts email + password via web form
2. Verifies credentials against Docker Mailserver via IMAP (ImapFlow library)
3. Writes whitelisted IP to JSON file
4. Writes `.apply` trigger file

**Host apply script** (`/usr/local/bin/ip-whitelist-apply.sh`):
1. Reads whitelist JSON (awk-based parsing, no python3 required)
2. Creates/rebuilds `UNRAID-WHITELIST` iptables chain
3. Inserts jump rule at INPUT position 1
4. Adds static IPs + all employee IPs + DROP rule
5. Runs every minute via cron

### Architecture Decision
- Container uses `network_mode: host` so it can reach IMAP on 127.0.0.1:143
- Container does NOT run iptables (Alpine lacks xtables extension .so libs)
- iptables management is 100% on the Unraid host side
- Port 3010 locked (Docker subnet + localhost only)

### Files Created
- `/mnt/disk1/appdata/ip-manager/docker-compose.yml`
- `/mnt/disk1/appdata/ip-manager/server/Dockerfile`
- `/mnt/disk1/appdata/ip-manager/server/server.js`
- `/mnt/disk1/appdata/ip-manager/server/public/index.html`
- `/mnt/disk1/appdata/ip-manager/server/package.json`
- `/usr/local/bin/ip-whitelist-apply.sh` (also at /boot/config/ for persistence)
- `/boot/config/go` (updated multiple times)

### Tested & Verified
- IMAP auth working (mailserver logs confirm login attempts from 172.17.0.1)
- UNRAID-WHITELIST chain created and functional
- Host apply script tested manually and via cron
- Port 3010 confirmed locked from external

---

## Session 3 — HTTPS Endpoint for IP Manager

### Problem
Port 3010 is not publicly accessible. Employees need an HTTPS URL.

### Solution
- Created Cloudflare DNS A record: `access.x-ceed.net` → server IP (DNS-only, not proxied)
- Added NPM proxy host: `access.x-ceed.net` → `http://localhost:3010`
- SSL: Let's Encrypt DNS-01 challenge via Cloudflare API (propagation 120s)
- Employees now access: `https://access.x-ceed.net`

---

## Deferred Items

| Item | Notes |
|---|---|
| Clean up legacy 8888/8883 INPUT rules in /boot/config/go | Will cause duplicate (harmless but messy) rules on reboot |
| SSH hardening | Check PasswordAuthentication, PermitRootLogin |
| Backup strategy | /boot/config, /mnt/disk1/appdata, bot databases |
| Stripe live keys | Configure in skyhigh-hosting-bot .env |
| Log monitoring | No alerting on auth failures or iptables drops |
