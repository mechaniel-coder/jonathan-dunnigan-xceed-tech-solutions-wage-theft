#!/bin/bash
set -e

# Load .env
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in your values."
  exit 1
fi
export $(grep -v '^#' .env | xargs)

NETWORK="skyhigh-net"
DB_CONTAINER="skyhigh-bot-db"
BOT_CONTAINER="skyhigh-bot"
DB_DATA_DIR="/skyhigh-bot-db-data"

echo "==> Creating Docker network (if needed)..."
docker network create $NETWORK 2>/dev/null || true

echo "==> Starting database..."
docker rm -f $DB_CONTAINER 2>/dev/null || true
docker run -d \
  --name $DB_CONTAINER \
  --network $NETWORK \
  --restart unless-stopped \
  -e MYSQL_ROOT_PASSWORD="${DB_ROOT_PASSWORD}" \
  -e MYSQL_DATABASE="skyhigh_bot" \
  -e MYSQL_USER="${DB_USER}" \
  -e MYSQL_PASSWORD="${DB_PASSWORD}" \
  -v ${DB_DATA_DIR}:/var/lib/mysql \
  -v "$(pwd)/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql" \
  -v "$(pwd)/schema_v2.sql:/docker-entrypoint-initdb.d/02-schema_v2.sql" \
  -v "$(pwd)/schema_v3.sql:/docker-entrypoint-initdb.d/03-schema_v3.sql" \
  mariadb:11

echo "==> Waiting for database to be ready..."
for i in $(seq 1 30); do
  if docker exec $DB_CONTAINER mariadb -u root -p"${DB_ROOT_PASSWORD}" -e "SELECT 1" &>/dev/null; then
    echo "    Database is ready."
    break
  fi
  echo "    Waiting... ($i/30)"
  sleep 3
done

echo "==> Building bot image..."
docker rm -f $BOT_CONTAINER 2>/dev/null || true
docker build -t skyhigh-bot-image .

echo "==> Starting bot..."
docker run -d \
  --name $BOT_CONTAINER \
  --network $NETWORK \
  --restart unless-stopped \
  -e BOT_TOKEN="${BOT_TOKEN}" \
  -e CLIENT_ID="${CLIENT_ID}" \
  -e GUILD_ID="${GUILD_ID}" \
  -e DB_HOST="$DB_CONTAINER" \
  -e DB_PORT="3306" \
  -e DB_USER="${DB_USER}" \
  -e DB_PASSWORD="${DB_PASSWORD}" \
  -e DB_NAME="skyhigh_bot" \
  -e HEALTH_PORT="3002" \
  -p 3002:3002 \
  skyhigh-bot-image

echo ""
echo "==> Done! Bot is running."
echo "    Logs: docker logs -f $BOT_CONTAINER"
