# Security Audit Summary — XCEED Tech Unraid Server
**Audit Date:** 2026-05-22  
**Auditor:** GitHub Copilot / DevOps assistant  
**Scope:** Unraid host, Docker services, iptables rules, mail server, reverse proxy

---

## Completed Hardening

### 1. Unraid Web UI (Ports 8888 / 8883)
- **Before:** Accessible from any IP on the internet
- **After:** Protected by dedicated `UNRAID-WHITELIST` iptables chain
- **Method:** INPUT chain at position 1, jumps to UNRAID-WHITELIST; default DROP at end of chain
- **Dynamic employee IPs:** Managed via ip-manager app; JSON whitelist rebuilt every minute via cron
- **Static IPs in chain:** Admin IP, server subnet, localhost

### 2. Database Ports (3306, 3307)
- **Before:** Potentially accessible via Docker's FORWARD chain
- **After:** DOCKER-USER chain rules DROP all packets to 3306/3307 not from Docker subnet
- **Persists:** /boot/config/go

### 3. Admin-Only Ports
- Ports 81, 8080, 8025, 3002, 53135, 4190 — restricted to admin IP via iptables INPUT
- NPM admin panel (port 81) not publicly accessible

### 4. IP Manager Endpoint (Port 3010)
- Runs on `network_mode: host` (required for IMAP to reach mailserver on 127.0.0.1:143)
- Port 3010 locked: only Docker subnet (172.16.0.0/12) and localhost can reach it directly
- Public access via NPM reverse proxy over HTTPS (access.x-ceed.net)
- Rate limiting: 10 requests per 15 minutes per IP on /update-ip
- Auth: IMAP credential verification against Docker Mailserver (no stored passwords)

### 5. Mail Server
- Docker Mailserver with TLS, DKIM, SPF/DMARC
- Accounts use SHA-512-CRYPT password hashing
- IMAP used internally for authentication only (port 143, bridge network)

### 6. SSL / TLS
- All public HTTPS via Let's Encrypt (DNS-01 challenge via Cloudflare API)
- NPM handles cert renewal automatically
- access.x-ceed.net: DNS-only (non-proxied) Cloudflare record for cert challenge

---

## Known Remaining Issues / Deferred Items

| Issue | Risk | Status |
|---|---|---|
| /boot/config/go has legacy static INPUT rules for 8888/8883 | On reboot, old rules will be added AFTER apply script — creates redundant INPUT rules but UNRAID-WHITELIST chain still controls access | ⏳ Deferred |
| SSH password auth status unknown | If enabled, brute-force risk | ⏳ Deferred |
| WordPress xmlrpc.php exposed | Common attack vector | ⏳ Not assessed |
| Unraid OS not updated (version unknown) | OS-level vulnerabilities | ⏳ Not assessed |
| No log monitoring / alerting | Silent compromise possible | ⏳ Deferred |
| Backup strategy not implemented | Data loss risk | ⏳ Deferred |

---

## Secrets Management

- All secrets in `.env` files (not committed to repo for bot)
- Config files use `process.env.*` — no hardcoded secrets in source code
- Cloudflare API token has minimum-scope permission (Zone:DNS:Edit for x-ceed.net only)
- Stripe keys: test keys in dev; live keys not yet configured

---

## Notes for Next Engineer

- iptables rules are in `/boot/config/go` — edit this file to change what persists on reboot
- The `UNRAID-WHITELIST` chain is rebuilt every minute by `/usr/local/bin/ip-whitelist-apply.sh`
- Do NOT add static INPUT rules for 8888/8883 — they conflict with the dynamic whitelist chain
- `iptables-legacy` must be used (not `iptables`/nft) on this Unraid build
