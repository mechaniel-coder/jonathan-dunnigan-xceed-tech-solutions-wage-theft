#!/bin/bash
# /usr/local/bin/ip-whitelist-apply.sh
# Rebuilds the UNRAID-WHITELIST iptables chain from whitelist.json
# Called by cron every minute and on boot.

WHITELIST_FILE="/mnt/disk1/appdata/ip-manager/server/data/whitelist.json"
TRIGGER_FILE="/mnt/disk1/appdata/ip-manager/server/data/.apply"
CHAIN="UNRAID-WHITELIST"
MANAGED_PORTS="8888,8883"
STATIC_IPS="[ADMIN_IP_REDACTED] 107.223.74.160/29 127.0.0.1"

# Create chain if it doesn't exist
iptables-legacy -N "$CHAIN" 2>/dev/null

# Remove stale jump rule, then re-add at top of INPUT
iptables-legacy -D INPUT -p tcp -m multiport --dports "$MANAGED_PORTS" -j "$CHAIN" 2>/dev/null
iptables-legacy -I INPUT 1 -p tcp -m multiport --dports "$MANAGED_PORTS" -j "$CHAIN"

# Clean up old individual INPUT rules for 8888/8883 (from before ip-manager)
for attempt in $(seq 1 20); do
  LINE=$(iptables-legacy -L INPUT -n --line-numbers 2>/dev/null | awk '/(ACCEPT|DROP).*tcp.*dpt[s]?.*88[68][83]/ {print $1; exit}')
  [ -z "$LINE" ] && break
  iptables-legacy -D INPUT "$LINE" 2>/dev/null
done

# Flush the chain and rebuild
iptables-legacy -F "$CHAIN"

for ip in $STATIC_IPS; do
  iptables-legacy -A "$CHAIN" -s "$ip" -j ACCEPT
done

# Add user IPs from whitelist JSON
if [ -f "$WHITELIST_FILE" ]; then
  python3 -c "
import json, sys
try:
    with open('$WHITELIST_FILE') as f:
        data = json.load(f)
    for user, entry in data.items():
        ip = entry.get('ip','').strip()
        if ip and all(0 <= int(x) <= 255 for x in ip.split('.') if x.isdigit()) and ip.count('.') == 3:
            print(ip)
except Exception as e:
    sys.exit(0)
" 2>/dev/null | while IFS= read -r ip; do
    iptables-legacy -A "$CHAIN" -s "$ip" -j ACCEPT
  done
fi

# Final catch-all DROP
iptables-legacy -A "$CHAIN" -j DROP

# Remove trigger file
rm -f "$TRIGGER_FILE"

echo "[$(date)] ip-whitelist-apply: chain rebuilt" >> /var/log/ip-whitelist.log
