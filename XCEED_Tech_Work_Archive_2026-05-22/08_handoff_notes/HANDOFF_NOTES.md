# Handoff Notes — XCEED Tech Infrastructure
**Date:** 2026-05-22  
**Prepared by:** GitHub Copilot / DevOps assistant

---

## Critical: Read Before Touching Anything

### Unraid Startup Script
`/boot/config/go` — this runs on every boot. All iptables rules live here.  
**Do not** add static INPUT rules for ports 8888 or 8883 — the dynamic whitelist chain handles those.

### iptables Version
This Unraid build uses **iptables-legacy** (not iptables-nft).  
Always use `iptables-legacy` in scripts, not `iptables`.

### docker-compose Binary
The system `docker-compose` may not be in PATH. The working binary is at `/tmp/docker-compose` — but `/tmp` does not persist across reboots.  
If it's missing after reboot: `curl -L "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64" -o /tmp/docker-compose && chmod +x /tmp/docker-compose`

---

## IP Manager System

**Purpose:** Lets employees register their dynamic home IP to access the Unraid web UI.

**Employee URL:** `https://access.x-ceed.net`  
**Login:** Their mailserver email + password (same as their @x-ceed.net email account)

**How it works:**
1. Employee visits URL, enters credentials + their IP is auto-detected
2. Server verifies credentials via IMAP against Docker Mailserver (port 143)
3. IP written to `/mnt/disk1/appdata/ip-manager/server/data/whitelist.json`
4. `.apply` trigger file written
5. Cron job on host runs `/usr/local/bin/ip-whitelist-apply.sh` every minute
6. Script rebuilds `UNRAID-WHITELIST` iptables chain with updated IPs

**To add an employee:** Create their mailserver account using Docker Mailserver CLI.  
`docker exec -it Docker-Mailserver setup email add user@x-ceed.net`

**To remove an employee IP:** Their IP will naturally drop from whitelist if they don't re-register. The JSON file can also be edited manually at the path above.

**Whitelist JSON location:** `/mnt/disk1/appdata/ip-manager/server/data/whitelist.json`

---

## Nginx Proxy Manager

**Admin Panel:** `http://[SERVER_IP]:81` — restricted to admin IP only  
**Default login:** Changed from default — check with previous admin.

**Active proxy hosts:**
- `access.x-ceed.net` → `http://localhost:3010` (HTTPS, Let's Encrypt DNS-01)

**Cert renewal:** Automatic via NPM. Cloudflare API token stored in NPM cert config.

---

## Mail Server (Docker Mailserver)

**Config location:** `/mnt/disk1/appdata/dms/`  
**Accounts file:** `/mnt/disk1/appdata/dms/config/postfix-accounts.cf`  
**Mail data:** `/mnt/disk1/appdata/dms/mail-data/`

**To manage accounts:**
```bash
docker exec -it Docker-Mailserver setup email list
docker exec -it Docker-Mailserver setup email add user@x-ceed.net
docker exec -it Docker-Mailserver setup email del user@x-ceed.net
docker exec -it Docker-Mailserver setup email update user@x-ceed.net
```

---

## Discord Bots

### skyhigh-hosting-bot
- **Location:** `/mnt/disk1/appdata/skyhigh-hosting-bot/`
- **Purpose:** Customer-facing hosting bot with Stripe payments, service management, dashboard
- **Database:** MariaDB (`skyhigh` database on mariadb-official container)
- **Stripe:** Currently test keys — live keys need to be set in `.env` before go-live
- **Dashboard:** Exposed via NPM (check proxy hosts)

### skyhigh-bot (Community Bot)
- **Location:** `/mnt/disk1/appdata/skyhigh-bot/`
- **Purpose:** Community Discord bot (leveling, economy, tickets, moderation)
- **Database:** MariaDB (`skyhigh_bot` database)

---

## Immediate Action Items for Next Engineer

1. **Fix /boot/config/go** — remove the old static INPUT rules for 8888/8883 (lines that directly add INPUT chain rules for those ports, before the ip-whitelist-apply.sh block)
2. **SSH hardening** — run `grep -E "PasswordAuth|PermitRoot" /etc/ssh/sshd_config` and disable password auth
3. **Stripe live keys** — update `.env` in skyhigh-hosting-bot before accepting real payments
4. **Backup strategy** — implement at minimum: daily rsync of `/boot/config/` and `/mnt/disk1/appdata/` to off-site storage
5. **Log monitoring** — set up logwatch or Grafana/Loki for iptables DROP events and auth failures

---

## Useful Commands

```bash
# View current iptables whitelist chain
iptables-legacy -L UNRAID-WHITELIST -n -v

# View INPUT chain
iptables-legacy -L INPUT -n -v --line-numbers

# Manually run IP whitelist apply
bash /usr/local/bin/ip-whitelist-apply.sh

# View whitelist JSON
cat /mnt/disk1/appdata/ip-manager/server/data/whitelist.json

# View apply script log
tail -f /var/log/ip-whitelist.log

# List all running containers
docker ps

# Restart ip-manager
cd /mnt/disk1/appdata/ip-manager && /tmp/docker-compose restart

# View ip-manager logs
docker logs -f ip-manager
```
