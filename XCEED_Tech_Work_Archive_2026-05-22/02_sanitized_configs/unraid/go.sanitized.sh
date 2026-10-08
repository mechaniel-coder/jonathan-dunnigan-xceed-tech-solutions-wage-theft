#!/bin/bash
export UNRAID_GUID=[REDACTED]
export UNRAID_NAME=Tower
export UNRAID_DATE=1654646400
export UNRAID_VERSION=Pro
/lib64/ld-linux-x86-64.so.2 /boot/config/unraider
# Start the Management Utility
/usr/local/sbin/emhttp
cp /boot/config/docker-compose /tmp/docker-compose && chmod +x /tmp/docker-compose

# Lock down MariaDB port 3306 to allowed IPs only
iptables -I DOCKER-USER 1 -s 107.223.74.161 -p tcp --dport 3306 -j ACCEPT
iptables -I DOCKER-USER 2 -s 107.223.74.162 -p tcp --dport 3306 -j ACCEPT
iptables -I DOCKER-USER 3 -s 107.223.74.163 -p tcp --dport 3306 -j ACCEPT
iptables -I DOCKER-USER 4 -s 127.0.0.1 -p tcp --dport 3306 -j ACCEPT
iptables -I DOCKER-USER 5 -p tcp --dport 3306 -j DROP

# Port 3307 - Wordpress-DB
iptables -I DOCKER-USER 1 -s 172.16.0.0/12 -p tcp --dport 3307 -j ACCEPT
iptables -I DOCKER-USER 2 -s 107.223.74.160/29 -p tcp --dport 3307 -j ACCEPT
iptables -I DOCKER-USER 3 -s 127.0.0.1 -p tcp --dport 3307 -j ACCEPT
iptables -I DOCKER-USER 4 -p tcp --dport 3307 -j DROP

# Port 81 - NPM admin
iptables -I DOCKER-USER 5 -s [ADMIN_IP_REDACTED] -p tcp --dport 81 -j ACCEPT
iptables -I DOCKER-USER 6 -s 127.0.0.1 -p tcp --dport 81 -j ACCEPT
iptables -I DOCKER-USER 7 -p tcp --dport 81 -j DROP

# Port 8080 - Paymenter
iptables -I DOCKER-USER 8 -s 172.16.0.0/12 -p tcp --dport 8080 -j ACCEPT
iptables -I DOCKER-USER 9 -s 127.0.0.1 -p tcp --dport 8080 -j ACCEPT
iptables -I DOCKER-USER 10 -p tcp --dport 8080 -j DROP

# Port 8025 - Roundcube
iptables -I DOCKER-USER 11 -s 172.16.0.0/12 -p tcp --dport 8025 -j ACCEPT
iptables -I DOCKER-USER 12 -s 127.0.0.1 -p tcp --dport 8025 -j ACCEPT
iptables -I DOCKER-USER 13 -p tcp --dport 8025 -j DROP

# Port 3002 - Bot webhook
iptables -I DOCKER-USER 14 -s 172.16.0.0/12 -p tcp --dport 3002 -j ACCEPT
iptables -I DOCKER-USER 15 -s 107.223.74.160/29 -p tcp --dport 3002 -j ACCEPT
iptables -I DOCKER-USER 16 -s 127.0.0.1 -p tcp --dport 3002 -j ACCEPT
iptables -I DOCKER-USER 17 -p tcp --dport 3002 -j DROP

# Port 53135 - Nextdactyl
iptables -I DOCKER-USER 18 -s 172.16.0.0/12 -p tcp --dport 53135 -j ACCEPT
iptables -I DOCKER-USER 19 -s 107.223.74.160/29 -p tcp --dport 53135 -j ACCEPT
iptables -I DOCKER-USER 20 -s 127.0.0.1 -p tcp --dport 53135 -j ACCEPT
iptables -I DOCKER-USER 21 -p tcp --dport 53135 -j DROP

# Port 4190 - ManageSieve
iptables -I DOCKER-USER 22 -s 172.16.0.0/12 -p tcp --dport 4190 -j ACCEPT
iptables -I DOCKER-USER 23 -s 107.223.74.160/29 -p tcp --dport 4190 -j ACCEPT
iptables -I DOCKER-USER 24 -s 127.0.0.1 -p tcp --dport 4190 -j ACCEPT
iptables -I DOCKER-USER 25 -p tcp --dport 4190 -j DROP

# Unraid web UI - restrict to admin IP only
iptables -I INPUT 1 -s [ADMIN_IP_REDACTED] -p tcp --dport 8888 -j ACCEPT
iptables -I INPUT 2 -s 107.223.74.160/29 -p tcp --dport 8888 -j ACCEPT
iptables -I INPUT 3 -s 127.0.0.1 -p tcp --dport 8888 -j ACCEPT
iptables -I INPUT 4 -p tcp --dport 8888 -j DROP
iptables -I INPUT 5 -s [ADMIN_IP_REDACTED] -p tcp --dport 8883 -j ACCEPT
iptables -I INPUT 6 -s 107.223.74.160/29 -p tcp --dport 8883 -j ACCEPT
iptables -I INPUT 7 -s 127.0.0.1 -p tcp --dport 8883 -j ACCEPT
iptables -I INPUT 8 -p tcp --dport 8883 -j DROP

# IP whitelist manager - restore script, set up cron, initial apply
cp /boot/config/ip-whitelist-apply.sh /usr/local/bin/ip-whitelist-apply.sh
chmod +x /usr/local/bin/ip-whitelist-apply.sh
echo "* * * * * root /usr/local/bin/ip-whitelist-apply.sh >/dev/null 2>&1" > /etc/cron.d/ip-whitelist
/usr/local/bin/ip-whitelist-apply.sh

# Lock port 3010 (ip-manager API - Docker/local only)
iptables-legacy -I INPUT 1 -s 172.16.0.0/12 -p tcp --dport 3010 -j ACCEPT
iptables-legacy -I INPUT 2 -s 127.0.0.1 -p tcp --dport 3010 -j ACCEPT
iptables-legacy -I INPUT 3 -p tcp --dport 3010 -j DROP
