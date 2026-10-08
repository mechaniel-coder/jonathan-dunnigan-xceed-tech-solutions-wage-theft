# Service Inventory — XCEED Tech Unraid Server
**Date:** 2026-05-22  
**Server IP:** [REDACTED]  
**OS:** Unraid (RAM-based, persists via /boot)

---

## Running Docker Services

| Service | Container Name | Internal Port | External Port | Network | Purpose |
|---|---|---|---|---|---|
| Docker Mailserver | Docker-Mailserver | 25,143,465,587,993 | 25,143,465,587,993 | bridge (172.17.x.x) | SMTP/IMAP for x-ceed.net |
| Nginx Proxy Manager | nginx-proxy-manager | 80,443,81 | 443,81 | 172.22.0.0/16 | Reverse proxy, SSL termination |
| MariaDB (official) | mariadb-official | 3306 | 3306 (locked) | bridge | Shared database host |
| Skyhigh Hosting Bot | skyhigh-hosting-bot | — | — | bridge | Discord bot + hosting dashboard |
| Skyhigh Community Bot | skyhigh-bot | — | — | bridge | Discord community bot |
| IP Manager | ip-manager | 3010 | 3010 (locked) | host | Dynamic IP whitelist manager |
| ViewTube | viewtube | — | — | bridge | Self-hosted YouTube frontend |
| Invidious | invidious | — | — | bridge | Self-hosted YouTube proxy |
| WordPress | wordpress | 80 | 80 (Apache) | host | Company website |

---

## Host-Side Services

| Service | Port | Notes |
|---|---|---|
| Unraid Web UI | 8888 (HTTP), 8883 (HTTPS) | Protected by UNRAID-WHITELIST iptables chain |
| Apache (WordPress) | 80 | Binds to external interface |
| SSH | 22 | Root login via key |
| Nginx (Unraid built-in) | 8888 | Served on external IP |

---

## Domain / DNS

| Subdomain | Points To | Proxied | Purpose |
|---|---|---|---|
| x-ceed.net | [REDACTED] | — | Root domain |
| access.x-ceed.net | [REDACTED server IP] | No (DNS only) | IP Manager HTTPS endpoint |
| mail.x-ceed.net | [REDACTED] | — | Mail MX record |

Registrar/DNS: **Cloudflare**  
SSL: Let's Encrypt via NPM DNS-01 (Cloudflare API)

---

## Mail Server Accounts

| Account | Role |
|---|---|
| admin@x-ceed.net | System admin |
| ceo@x-ceed.net | Executive |
| cfo@x-ceed.net | Finance |
| cto@x-ceed.net | Technical lead |

Password hashes stored in `/mnt/disk1/appdata/dms/config/postfix-accounts.cf` (SHA-512-CRYPT).

---

## Port Lockdown Summary

| Port | Locked To | Method |
|---|---|---|
| 8888, 8883 | UNRAID-WHITELIST chain (dynamic employee IPs + admin IP) | iptables-legacy INPUT |
| 3306 | Docker internal only | DOCKER-USER chain |
| 3307 | Docker internal only | DOCKER-USER chain |
| 81 (NPM admin) | Admin IP only | iptables-legacy |
| 8080 | Admin IP only | iptables-legacy |
| 8025 (MailHog) | Admin IP only | iptables-legacy |
| 3002 | Admin IP only | iptables-legacy |
| 53135 | Admin IP only | iptables-legacy |
| 4190 | Admin IP only | iptables-legacy |
| 3010 (IP Manager) | Docker subnet + localhost | iptables-legacy INPUT |

All rules persist via `/boot/config/go` (Unraid startup script).
