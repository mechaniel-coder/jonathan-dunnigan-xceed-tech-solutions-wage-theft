# XCEED Tech Work Archive — Purpose & Overview

**Archive Date**: 2026-05-22  
**Prepared by**: DevOps Engineering  
**Server**: Unraid (Tower) — x-ceed.net infrastructure  
**Purpose**: Professional non-destructive documentation archive for continuity, handoff, and proof of work.

## What This Archive Contains

This archive captures the source code, sanitized configurations, security audit findings, service inventory, and work log for the XCEED Tech Unraid server infrastructure as of the archive date.

It is designed to:
- Provide a complete handoff package for any future engineer taking over the system
- Prove authorship of custom software components built for x-ceed.net
- Document the security posture and hardening steps applied
- Enable reconstruction of the full infrastructure from scratch if needed

## What This Archive Does NOT Contain

The following were intentionally excluded to protect security and privacy:
- `.env` files (Discord tokens, DB passwords, Stripe/PayPal/Square API keys)
- SSL/TLS private key files
- SSH private keys
- Raw database files or dumps
- Customer email data (`mail-data/`)
- Password hashes (`postfix-accounts.cf`)
- VAPID private keys (`viewtube/config.json`)
- Cloudflare API tokens
- Any Stripe live/test secret keys

## Archive Structure

```
01_source_code/         Custom applications built for this project
02_sanitized_configs/   Docker Compose + environment configs (secrets redacted)
03_documentation/       Architecture and setup documentation
04_security_audit/      Security hardening audit and findings
05_service_inventory/   Complete service and port inventory
06_work_log/            Changelog and session work log
07_screenshots_or_evidence/  Reserved for screenshots (not captured programmatically)
08_handoff_notes/       Engineer handoff documentation
```

## Redactions Applied

The following substitutions were made in sanitized config files:
- Admin IP address → `[ADMIN_IP_REDACTED]`
- Unraid license GUID → `[REDACTED]`
- All `.env` files excluded entirely

## Server at a Glance

| Item | Value |
|------|-------|
| OS | Unraid (RAM-based, config persists to /boot) |
| Domain | x-ceed.net |
| Hosting IP | 107.223.74.163 |
| IP range | 107.223.74.160/29 |
| iptables backend | iptables-legacy |
| Docker Compose binary | /tmp/docker-compose (v2.27.0) — restored on boot from /boot/config/ |
