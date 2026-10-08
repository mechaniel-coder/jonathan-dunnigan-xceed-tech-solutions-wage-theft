# MASTER CONTEXT — XCEED Tech Infrastructure
**Last Updated:** 2026-05-22  
**Purpose:** Complete technical reference. Any AI assistant reading this file has full context to continue work without additional exploration.

---

## 1. SERVER

| Property | Value |
|---|---|
| OS | Unraid Pro (RAM-based — all changes must be persisted to /boot) |
| Public IP | 107.223.74.163 |
| IP Block | 107.223.74.160/29 (107.223.74.160–167) |
| Hostname | Tower |
| SSH | root@107.223.74.163 port 22, key auth (ED25519) |
| Admin home IP | 76.33.191.130 |
| Timezone | America/Los_Angeles (PDT, UTC-7) |
| iptables binary | iptables-legacy (NOT iptables / nft — this is critical) |
| docker-compose | /tmp/docker-compose (v2.27.0) — /tmp does NOT persist reboots |
| Startup script | /boot/config/go — runs on every boot, source of truth for all iptables rules |
| Appdata base | /mnt/disk1/appdata/ |
| python3 | NOT available on host — use awk/grep/sed instead |

---

## 2. NETWORK TOPOLOGY

### Docker Networks
| Network Name | Driver | Subnet | Gateway | Containers |
|---|---|---|---|---|
| bridge (default) | bridge | 172.17.0.0/16 | 172.17.0.1 | Docker-Mailserver (172.17.0.2), Skyhigh-DB (172.17.0.3), Wordpress-DB (172.17.0.4) |
| skyhigh-net | bridge | 172.18.0.0/16 | 172.18.0.1 | nextdactyl (172.18.0.2), skyhigh-bot (172.18.0.3), paymenter (172.18.0.4) |
| nginx-proxy-manager_default | bridge | 172.22.0.0/16 | 172.22.0.1 | nginx-proxy-manager (172.22.0.2) |
| skyhigh-hosting-bot_default | bridge | auto | — | skyhigh-bot, skyhigh-bot-db |
| paymenter_paymenter_nw | bridge | auto | — | paymenter, paymenter-db, paymenter-redis |
| roundcube_default | bridge | auto | — | roundcube |
| host | host | — | — | ip-manager, WordPress |
| eth0 | macvlan | — | — | (Unraid bridge) |

### Key Internal Routing
- ip-manager → Docker-Mailserver: `127.0.0.1:143` (both on host network)
- skyhigh-bot → skyhigh-bot-db: `db:3306` (same docker-compose network)
- skyhigh-bot → nextdactyl: `http://nextdactyl:53135` (skyhigh-net)
- skyhigh-bot → paymenter: `http://paymenter:80` (skyhigh-net — paymenter also on skyhigh-net)
- NPM → all services: proxies via host IP `107.223.74.163:<port>`

---

## 3. ALL RUNNING SERVICES

### ip-manager
| Property | Value |
|---|---|
| Container | ip-manager |
| Image | ip-manager-ip-manager (built locally) |
| Network | host |
| Port | 3010 |
| Appdata | /mnt/disk1/appdata/ip-manager/ |
| Compose | /mnt/disk1/appdata/ip-manager/docker-compose.yml |
| Source | /mnt/disk1/appdata/ip-manager/server/ |
| Data/whitelist | /mnt/disk1/appdata/ip-manager/server/data/whitelist.json |
| Trigger file | /mnt/disk1/appdata/ip-manager/server/data/.apply |
| Public URL | https://access.x-ceed.net |
| Purpose | Employees authenticate via IMAP (mailserver creds), their IP is written to whitelist JSON, host cron applies iptables rules every minute |
| IMAP auth | Connects to 127.0.0.1:143 (Docker-Mailserver on host network) using ImapFlow library |
| Rate limit | 10 req / 15 min on POST /update-ip |
| Env vars | PORT=3010, IMAP_HOST=127.0.0.1, IMAP_PORT=143, DATA_FILE=/app/data/whitelist.json |

**API Endpoints:**
- `POST /update-ip` — body: `{email, password}` — verifies IMAP, saves IP
- `GET /my-ip` — returns detected client IP (reads X-Forwarded-For from NPM)
- `GET /health` — returns uptime JSON

### Skyhigh Hosting Bot (skyhigh-bot)
| Property | Value |
|---|---|
| Container | skyhigh-bot |
| Image | skyhigh-hosting-bot-bot (built locally) |
| Network | skyhigh-hosting-bot_default + skyhigh-net |
| Port | 3002 (health/dashboard/webhooks) |
| Appdata | /mnt/disk1/appdata/skyhigh-hosting-bot/ |
| GitHub | github.com/mechaniel-coder/skyhigh-hosting-bot (private) |
| Database | skyhigh-bot-db (MariaDB 11, container), DB name: skyhigh_bot |
| DB volumes | /mnt/user/appdata/skyhigh-bot-db |
| Schema | schema.sql through schema_v9.sql (applied in order at DB init) |
| Purpose | Full Discord bot for hosting company — moderation, economy, tickets, leveling, giveaways, Stripe payments, web dashboard, service monitoring, Nextdactyl integration |

**Key env vars (from .env, values redacted):**
- BOT_TOKEN, CLIENT_ID, GUILD_ID
- DB_HOST=db, DB_PORT=3306, DB_USER, DB_PASSWORD, DB_NAME=skyhigh_bot
- DISCORD_CLIENT_SECRET, SESSION_SECRET
- DASHBOARD_ADMIN_IDS (comma-separated Discord user IDs)
- OAUTH_REDIRECT_URI (Discord OAuth callback)
- WEBSITE_API_URL, WEBSITE_API_KEY (Nextdactyl integration)
- NEXTDACTYL_URL=http://nextdactyl:53135, NEXTDACTYL_SYNC_SECRET
- PORTAL_BASE_URL (billing portal URL sent in DMs)
- LICENSE_TOKEN (RSA license validation on startup)
- PAYMENTER_URL, PAYMENTER_API_KEY, PAYMENTER_WEBHOOK_SECRET
- HEALTH_PORT=3002

**Dashboard routes** (port 3002, Discord OAuth protected):
- `/dashboard` — main panel
- `/dashboard/login` — OAuth entry
- API routes under `/api/*` including:
  - /api/payment-config (GET/PUT) — Stripe/PayPal/Square keys from DB
  - /api/coin-packages, /api/transactions, /api/linked-accounts
  - /api/monitors (CRUD for health check monitors)
  - /api/settings, /api/level-roles, /api/autoresponders, /api/custom-cmds
  - /api/logs (live Docker log streaming)

**Discord slash commands:**
- Admin: announce, autorespond, automod, autorole, channel, customcmd, embed, levelroles, monitor, onboarding, reactroles, rolepanel, setleveling, setlog, setreviews, setstaff, setsuggestions, setwelcome, shopmanage, temprole, verify, xp
- Moderation: ban, unban, clearwarns, kick, note, purge, slowmode, timeout, untimeout, warn, warnings
- Giveaway: gend, giveaway, greroll
- Roles: getroles, rolereact
- Tickets: ticket
- Utility: balance, billing, daily, faq, help, leaderboard, level, link, lookup, pay, ping, plans, poll, remind, review, shop, status, suggest, work

**Key integrations:**
- **Nextdactyl**: `/link` command syncs Discord account → Nextdactyl panel account creation
- **Stripe**: coin shop payments, subscription plans (test keys currently)
- **Paymenter**: billing portal webhook bridge (DiscordNotifier extension)
- **RSA License**: startup validation via licenseCheck.js

### Docker Mailserver
| Property | Value |
|---|---|
| Container | Docker-Mailserver |
| Image | mailserver/docker-mailserver:latest |
| Network | bridge (172.17.0.2) |
| Appdata | /mnt/disk1/appdata/dms/ |
| Hostname | mail.x-ceed.net |
| SSL | Let's Encrypt via /etc/letsencrypt/live/mail.x-ceed.net/ |
| Config dir | /mnt/disk1/appdata/dms/config/ |
| Accounts file | /mnt/disk1/appdata/dms/config/postfix-accounts.cf (SHA-512-CRYPT hashes) |
| Mail data | /mnt/disk1/appdata/dms/mail-data/ |

**Ports:**
- 25 — SMTP inbound
- 143 — IMAP (used internally by ip-manager for auth)
- 465 — ESMTP TLS
- 587 — ESMTP STARTTLS
- 993 — IMAPS
- 4190 — ManageSieve (locked to Docker subnet)

**Mail accounts:** admin, ceo, cfo, cto, coo, founder, owner, info, hello, contact, office, sales, billing, invoices, payments, accounts, support, help, helpdesk, ticket, noreply, dev, devops, sysadmin, security, abuse, legal, compliance, hr, careers, jobs, marketing, press, media, partnerships — all @x-ceed.net

**Spam/antivirus:** ClamAV enabled, SpamAssassin enabled, Postgrey enabled (300s delay), Fail2Ban disabled

**Manage accounts:**
```bash
docker exec -it Docker-Mailserver setup email add user@x-ceed.net
docker exec -it Docker-Mailserver setup email list
docker exec -it Docker-Mailserver setup email del user@x-ceed.net
docker exec -it Docker-Mailserver setup email update user@x-ceed.net
```

### Nginx Proxy Manager (NPM)
| Property | Value |
|---|---|
| Container | nginx-proxy-manager |
| Image | jc21/nginx-proxy-manager:latest |
| Network | nginx-proxy-manager_default (172.22.0.0/16) |
| Admin panel | http://107.223.74.163:81 (locked to admin IP 76.33.191.130) |
| Appdata | /mnt/disk1/appdata/nginx-proxy-manager/ |
| SSL method | Let's Encrypt DNS-01 challenge via Cloudflare API |

**Active proxy hosts:**
| Domain | → Backend | SSL cert | Notes |
|---|---|---|---|
| billing.x-ceed.net | http://107.223.74.163:8080 | npm-6 | Paymenter billing portal |
| webmail.x-ceed.net | http://107.223.74.163:8025 | npm-6 | Roundcube webmail |
| access.x-ceed.net | http://107.223.74.163:3010 | npm-8 | IP Manager (employee whitelist) |

### Paymenter
| Property | Value |
|---|---|
| Container | paymenter |
| Image | ghcr.io/paymenter/paymenter:latest |
| Network | paymenter_paymenter_nw + skyhigh-net |
| Port | 8080 (locked to Docker subnet + localhost) |
| Internal | 9000/tcp (PHP-FPM, internal only) |
| Public URL | https://billing.x-ceed.net |
| DB | paymenter-db (MariaDB LTS), DB: paymenter |
| Cache | paymenter-redis (Redis Alpine) |
| Appdata | /mnt/disk1/appdata/paymenter/ |
| Volume | paymenter_paymenter_app (named Docker volume — app files) |
| Purpose | Customer billing portal — separate from Discord bot's coin economy |

**Key env vars (keys only):** APP_KEY, DB_PASSWORD, DB_ROOT_PASSWORD, PAYMENTER_APP_URL, PAYMENTER_PORT

### Roundcube Webmail
| Property | Value |
|---|---|
| Container | roundcube |
| Image | roundcube/roundcubemail:latest |
| Port | 8025 (locked to Docker subnet + localhost) |
| Public URL | https://webmail.x-ceed.net |
| Appdata | /mnt/disk1/appdata/roundcube/ |
| Connects to | Docker-Mailserver IMAP/SMTP |

### Nextdactyl
| Property | Value |
|---|---|
| Container | nextdactyl |
| Image | nextdactyl (built locally) |
| Network | skyhigh-net (172.18.0.2) |
| Port | 53135 (locked to Docker subnet + server subnet) |
| Connects to | skyhigh-bot via skyhigh-net |
| Purpose | Coin economy integration / panel account sync with Pterodactyl |

### WordPress
| Property | Value |
|---|---|
| Container | WordPress |
| Network | host |
| Port | 80 (Apache, direct — NOT through NPM) |
| DB | Wordpress-DB (MySQL, 172.17.0.4, port 3307 externally) |
| Appdata | /mnt/disk1/appdata/wordpress/ |
| Purpose | Company website |

### Databases
| Container | Image | Internal port | External port | DB name | Used by |
|---|---|---|---|---|---|
| Skyhigh-DB | mariadb (latest) | 3306 | 3306 (locked) | multiple | Legacy / shared |
| skyhigh-bot-db | mariadb:11 | 3306 | none | skyhigh_bot | skyhigh-bot |
| Wordpress-DB | mysql | 3306 | 3307 (locked), 33060/tcp exposed | wordpress | WordPress (DB_HOST=mysql) |
| paymenter-db | mariadb:lts | 3306 | none | paymenter | Paymenter |
| paymenter-redis | redis:alpine | 6379 | none | — | Paymenter cache |

**Named Docker volumes:**
| Volume | Used by |
|---|---|
| paymenter_paymenter_app | paymenter container app data |

---

## 4. DNS / DOMAINS (Cloudflare)

| Record | Type | Points to | Proxied | Purpose |
|---|---|---|---|---|
| x-ceed.net | A | 107.223.74.163 | TBD | Root domain |
| mail.x-ceed.net | A/MX | 107.223.74.163 | No | Mail server |
| access.x-ceed.net | A | 107.223.74.163 | No (DNS only) | IP Manager (cert challenge requires DNS-only) |
| billing.x-ceed.net | A | 107.223.74.163 | TBD | Paymenter |
| webmail.x-ceed.net | A | 107.223.74.163 | TBD | Roundcube |

**Cloudflare Zone:** x-ceed.net  
**Zone ID:** a2efdf8b9041d61007cfc6d0177fdaa0  
**API token scope:** Zone:DNS:Edit for x-ceed.net only

---

## 5. PORT MAP (full)

| Port | Protocol | Service | Access restriction | Method |
|---|---|---|---|---|
| 22 | TCP | SSH | Open (key auth only) | — |
| 25 | TCP | SMTP | Open | — |
| 80 | TCP | WordPress (Apache) | Open | — |
| 81 | TCP | NPM Admin | Admin IP only (76.33.191.130) | DOCKER-USER |
| 143 | TCP | IMAP | Open | — |
| 443 | TCP | HTTPS (NPM) | Open | — |
| 465 | TCP | ESMTP TLS | Open | — |
| 587 | TCP | ESMTP STARTTLS | Open | — |
| 993 | TCP | IMAPS | Open | — |
| 3002 | TCP | Bot dashboard/webhooks | Docker subnet + server subnet | DOCKER-USER |
| 3010 | TCP | ip-manager API | Docker subnet (172.16.0.0/12) + localhost | INPUT chain |
| 3306 | TCP | Skyhigh-DB MariaDB | Server subnet (107.223.74.160/29) + localhost | DOCKER-USER |
| 3307 | TCP | Wordpress-DB MySQL | Docker subnet + server subnet + localhost | DOCKER-USER |
| 4190 | TCP | ManageSieve | Docker subnet + server subnet + localhost | DOCKER-USER |
| 8025 | TCP | Roundcube | Docker subnet + localhost | DOCKER-USER |
| 8080 | TCP | Paymenter | Docker subnet + localhost | DOCKER-USER |
| 8883 | TCP | Unraid UI (HTTPS) | UNRAID-WHITELIST chain | INPUT chain |
| 8888 | TCP | Unraid UI (HTTP) | UNRAID-WHITELIST chain | INPUT chain |
| 53135 | TCP | Nextdactyl | Docker subnet + server subnet + localhost | DOCKER-USER |

---

## 6. IPTABLES ARCHITECTURE

### Two chains in use:
1. **DOCKER-USER** — Docker-managed chain in the FORWARD table. Controls what reaches container ports. Rules survive Docker restarts.
2. **INPUT** chain — Controls host-bound traffic (Unraid UI on 8888/8883, ip-manager on 3010)

### CRITICAL: iptables namespace split
`/boot/config/go` uses TWO different iptables binaries:
- `iptables` (plain) — used for all DOCKER-USER rules AND the old 8888/8883 INPUT rules
- `iptables-legacy` — used ONLY for port 3010 INPUT rules (lines 74-76 of go script)

**This means the 8 `iptables -I INPUT` rules for 8888/8883 in go are in the nft namespace and have NO effect on the iptables-legacy INPUT chain.** The live `iptables-legacy -L INPUT` only shows 4 rules (3010 x3 + UNRAID-WHITELIST jump).

**Why does DOCKER-USER work with plain `iptables`?** Docker writes DOCKER-USER into the iptables-legacy namespace, so that chain exists there. When go runs `iptables -I DOCKER-USER`, it inserts into the same legacy chain that Docker uses. This works. But INPUT is a kernel-native chain that exists independently in both namespaces.

**Bottom line:**
- DOCKER-USER rules from go: ✅ Working (legacy namespace, Docker manages it)
- Port 3010 INPUT rules from go: ✅ Working (explicitly uses iptables-legacy)
- 8888/8883 INPUT rules from go: ❌ Dead (plain `iptables` → nft namespace, ignored by kernel)
- 8888/8883 protection: ✅ ONLY provided by UNRAID-WHITELIST chain (iptables-legacy, installed by ip-whitelist-apply.sh)

### UNRAID-WHITELIST chain (live state as of 2026-05-22)
```
Chain UNRAID-WHITELIST (1 references)
1  ACCEPT  all  76.33.191.130       (admin home IP — static)
2  ACCEPT  all  107.223.74.160/29   (server subnet — static)
3  ACCEPT  all  127.0.0.1           (localhost — static)
4  DROP    all  0.0.0.0/0           (everything else)
```
**No employee IPs present** — this confirms the python3 bug in ip-whitelist-apply.sh (python3 not on host). Only static IPs work. Employee IPs from whitelist.json are never added.

Jump rule on INPUT: `-p tcp -m multiport --dports 8888,8883 -j UNRAID-WHITELIST` (always at position 4 after the 3010 rules)

### IP Whitelist cron
```
* * * * * root /usr/local/bin/ip-whitelist-apply.sh >/dev/null 2>&1
```
Cron file: `/etc/cron.d/ip-whitelist`  
Script: `/usr/local/bin/ip-whitelist-apply.sh` (runtime)  
Persisted: `/boot/config/ip-whitelist-apply.sh` (survives reboot)

### Live DOCKER-USER chain (as of 2026-05-22, 31 rules)
| Rules | Port | Allowed sources |
|---|---|---|
| 1-4 | 3307 | 172.16.0.0/12, 107.223.74.160/29, 127.0.0.1, DROP |
| 5-7 | 81 | 76.33.191.130, 127.0.0.1, DROP |
| 8-10 | 8080 | 172.16.0.0/12, 127.0.0.1, DROP |
| 11-13 | 8025 | 172.16.0.0/12, 127.0.0.1, DROP |
| 14-17 | 3002 | 172.16.0.0/12, 107.223.74.160/29, 127.0.0.1, DROP |
| 18-21 | 53135 | 172.16.0.0/12, 107.223.74.160/29, 127.0.0.1, DROP |
| 22-25 | 4190 | 172.16.0.0/12, 107.223.74.160/29, 127.0.0.1, DROP |
| 26-30 | 3306 | 107.223.74.161, 107.223.74.162, 107.223.74.163 (individual IPs, NOT /29), 127.0.0.1, DROP |
| 31 | — | RETURN (Docker default) |

Note: 3306 allows individual IPs .161/.162/.163 specifically — NOT the full /29 block.

---

## 7. BOOT PERSISTENCE (/boot/config/go)

Runs on every Unraid boot. Contains:
1. Unraid license/GUID export
2. `cp /boot/config/docker-compose /tmp/docker-compose && chmod +x` — restores docker-compose binary
3. DOCKER-USER rules for 3306, 3307, 81, 8080, 8025, 3002, 53135, 4190
4. Legacy static INPUT rules for 8888/8883 (should be removed — see known issue above)
5. `cp /boot/config/ip-whitelist-apply.sh /usr/local/bin/ip-whitelist-apply.sh` + chmod + cron install + initial run
6. INPUT rules locking port 3010 (ip-manager)

**To make any iptables rule survive reboot:** add it to /boot/config/go AND test it live with iptables-legacy.

---

## 8. IP WHITELIST SYSTEM (full flow)

```
Employee browser → https://access.x-ceed.net
  → NPM (443) → http://107.223.74.163:3010
    → ip-manager (Node.js, host network)
      → verifyCredentials(email, password)
        → ImapFlow connects to 127.0.0.1:143
          → Docker-Mailserver (bridge 172.17.0.2, published to 0.0.0.0:143)
          → login attempt: success/fail
      → if success: write IP to /app/data/whitelist.json
      → write /app/data/.apply trigger file
        → cron (every minute) detects .apply
          → ip-whitelist-apply.sh runs on HOST
            → reads whitelist.json (awk parsing, no python3)
            → rebuilds UNRAID-WHITELIST iptables chain
            → deletes .apply file
```

**Whitelist JSON format:**
```json
{
  "user@x-ceed.net": {
    "ip": "1.2.3.4",
    "updatedAt": "2026-05-22T00:00:00.000Z"
  }
}
```

**X-Forwarded-For:** NPM passes client IP via X-Forwarded-For header. ip-manager reads this to detect the employee's real IP.

---

## 9. FILE PATHS (all important files)

| Path | Description |
|---|---|
| /boot/config/go | Unraid startup script — all iptables, cron setup |
| /boot/config/ip-whitelist-apply.sh | Persisted copy of whitelist apply script |
| /boot/config/docker-compose | Persisted docker-compose binary (copied to /tmp on boot) |
| /tmp/docker-compose | Working docker-compose binary (RAM, lost on reboot) |
| /usr/local/bin/ip-whitelist-apply.sh | Runtime copy of whitelist apply script |
| /etc/cron.d/ip-whitelist | Cron job definition (every minute) |
| /var/log/ip-whitelist.log | Apply script log |
| /mnt/disk1/appdata/ip-manager/ | ip-manager container files |
| /mnt/disk1/appdata/ip-manager/server/data/whitelist.json | Employee IP whitelist |
| /mnt/disk1/appdata/ip-manager/server/data/.apply | Trigger file — exists = run apply script |
| /mnt/disk1/appdata/dms/ | Docker Mailserver config + data |
| /mnt/disk1/appdata/dms/config/postfix-accounts.cf | Mail accounts + hashed passwords |
| /mnt/disk1/appdata/nginx-proxy-manager/ | NPM data + certs |
| /mnt/disk1/appdata/nginx-proxy-manager/data/nginx/proxy_host/ | Proxy host nginx configs |
| /mnt/disk1/appdata/skyhigh-hosting-bot/ | Hosting bot source + compose + .env |
| /mnt/disk1/appdata/skyhigh-hosting-bot/src/index.js | Bot entry point |
| /mnt/disk1/appdata/skyhigh-hosting-bot/src/database.js | DB connection pool |
| /mnt/disk1/appdata/skyhigh-hosting-bot/src/config.js | Config loader |
| /mnt/disk1/appdata/skyhigh-hosting-bot/src/commands/ | All slash command handlers |
| /mnt/disk1/appdata/skyhigh-hosting-bot/src/events/ | All Discord event handlers |
| /mnt/disk1/appdata/skyhigh-hosting-bot/src/utils/ | auditLog, automodManager, buttonHandler, economyManager, giveawayManager, levelManager, licenseCheck, linkManager, logBroadcaster, logger, monitorManager, reminderManager, rolePanelManager, tempRoleManager, ticketManager, websiteApi |
| /mnt/disk1/appdata/skyhigh-hosting-bot/src/payments/ | coinCredit, paymentConfig, stripe |
| /mnt/disk1/appdata/skyhigh-hosting-bot/src/dashboard/ | api.js, auth.js, dockerLogs.js, index.js, payment.js, webhooks.js |
| /mnt/disk1/appdata/skyhigh-hosting-bot/src/dashboard/public/ | index.html, login.html, app.js, style.css, buy/ |
| /mnt/disk1/appdata/skyhigh-hosting-bot/.env | Bot secrets (BOT_TOKEN, DB creds, etc.) |
| /mnt/user/appdata/skyhigh-bot-db/ | Bot database volume |
| /mnt/disk1/appdata/wordpress/ | WordPress files |
| /mnt/disk1/appdata/paymenter/ | Paymenter app + DB volume |
| /var/log/syslog | Current syslog (SSH logins, iptables, etc.) |
| /var/log/syslog.1 | Previous rotation |

---

## 10. KNOWN ISSUES / DEFERRED WORK

| Issue | Priority | Notes |
|---|---|---|
| 8888/8883 INPUT rules in go use plain `iptables` (nft) | Medium | These 8 rules have NO effect on iptables-legacy INPUT. They're dead rules written to the wrong namespace. Can be removed from go — UNRAID-WHITELIST handles 8888/8883 correctly already. |
| ip-whitelist-apply.sh python3 bug | High | Script has `python3 -c` to parse JSON. python3 NOT on host. No employee IPs are ever added to UNRAID-WHITELIST — only the 3 static IPs. Fix: rewrite JSON parsing with awk. Confirmed: live UNRAID-WHITELIST has only 3 ACCEPT rules. |
| SSH hardening | High | PasswordAuthentication status unknown. Check: `grep -E "PasswordAuth\|PermitRoot" /etc/ssh/sshd_config` |
| Backup strategy | High | No automated backups. Key paths: /boot/config/, /mnt/disk1/appdata/, skyhigh-bot DB dump |
| Stripe live keys | High | skyhigh-hosting-bot .env has test keys. Must update before real payments. |
| No log monitoring | Medium | No alerting on iptables DROP storms or auth failures |
| docker-compose not persistent | Low | /tmp/docker-compose is lost on reboot. go script restores it from /boot/config/docker-compose — this is already handled. No action needed unless /boot/config/docker-compose is deleted. |
| PORTAL_BASE_URL in .env.example | Low | .env.example shows `http://107.223.74.163:3010` (ip-manager) — this is wrong if it's supposed to be the billing portal. Verify actual .env value. |

---

## 11. HOW TO RESTART / MANAGE SERVICES

```bash
# ip-manager
cd /mnt/disk1/appdata/ip-manager && /tmp/docker-compose restart
# Or force rebuild:
cd /mnt/disk1/appdata/ip-manager && /tmp/docker-compose build --no-cache && /tmp/docker-compose up -d --force-recreate

# skyhigh-hosting-bot
cd /mnt/disk1/appdata/skyhigh-hosting-bot && /tmp/docker-compose restart

# NPM
cd /mnt/disk1/appdata/nginx-proxy-manager && /tmp/docker-compose restart

# Mailserver
cd /mnt/disk1/appdata/dms && /tmp/docker-compose restart

# View logs
docker logs -f ip-manager
docker logs -f skyhigh-bot
docker logs -f Docker-Mailserver
docker logs -f nginx-proxy-manager

# Rebuild iptables whitelist manually
bash /usr/local/bin/ip-whitelist-apply.sh

# View whitelist chain
iptables-legacy -L UNRAID-WHITELIST -n -v

# View current whitelist
cat /mnt/disk1/appdata/ip-manager/server/data/whitelist.json
```

---

## 12. EXTERNAL SERVICES / APIS

| Service | Used by | Notes |
|---|---|---|
| Discord API | skyhigh-bot | OAuth2 for dashboard, slash commands, events |
| Stripe | skyhigh-bot payments | Test keys in .env — live keys not configured |
| Cloudflare API | NPM (cert renewal), DNS management | Token scope: Zone:DNS:Edit for x-ceed.net |
| Nextdactyl | skyhigh-bot (/link command) | Internal service on skyhigh-net |
| Paymenter | skyhigh-bot (billing), customers | Internal on skyhigh-net |
| GitHub | mechaniel-coder/skyhigh-hosting-bot | Private repo, used for deployment |

