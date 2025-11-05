#!/usr/bin/with-contenv bashio

# Enable error handling
set -e

bashio::log.info "Starting IntelliVend Add-on..."

# Get configuration
MYSQL_HOST=$(bashio::config 'mysql_host')
MYSQL_PORT=$(bashio::config 'mysql_port')
MYSQL_DB=$(bashio::config 'mysql_database')
MYSQL_USER=$(bashio::config 'mysql_user')
MYSQL_PASSWORD=$(bashio::config 'mysql_password')

MQTT_BROKER=$(bashio::config 'mqtt_broker')
MQTT_PORT=$(bashio::config 'mqtt_port')
MQTT_USER=$(bashio::config 'mqtt_user')
MQTT_PASSWORD=$(bashio::config 'mqtt_password')

LOG_LEVEL=$(bashio::config 'log_level')

# Wait for MySQL to be ready
bashio::log.info "Waiting for MySQL..."
timeout=30
while ! mysqladmin ping -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --silent 2>/dev/null; do
    timeout=$((timeout - 1))
    if [ $timeout -le 0 ]; then
        bashio::log.error "MySQL connection timeout!"
        exit 1
    fi
    sleep 1
done
bashio::log.info "MySQL is ready!"

# Check if database exists, if not create it
bashio::log.info "Checking database..."
DB_EXISTS=$(mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SHOW DATABASES LIKE '$MYSQL_DB';" | grep -c "$MYSQL_DB" || true)

if [ "$DB_EXISTS" -eq 0 ]; then
    bashio::log.info "Creating database..."
    mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "CREATE DATABASE $MYSQL_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
fi

# Check if tables exist
TABLE_COUNT=$(mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" -e "SHOW TABLES;" | wc -l)

if [ "$TABLE_COUNT" -le 1 ]; then
    bashio::log.info "Initializing database schema..."
    mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" < /app/database/schema.sql
    
    bashio::log.info "Loading sample data..."
    mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DB" < /app/database/seed.sql
fi

# Create .env file for backend
bashio::log.info "Configuring backend environment..."
cat > /app/backend/.env << EOF
NODE_ENV=production
PORT=3000

DB_HOST=$MYSQL_HOST
DB_PORT=$MYSQL_PORT
DB_NAME=$MYSQL_DB
DB_USER=$MYSQL_USER
DB_PASSWORD=$MYSQL_PASSWORD

MQTT_BROKER=$MQTT_BROKER
MQTT_PORT=$MQTT_PORT
MQTT_USERNAME=$MQTT_USER
MQTT_PASSWORD=$MQTT_PASSWORD

LOG_LEVEL=$LOG_LEVEL

API_SECRET=$(openssl rand -hex 32)
ESP32_API_KEY=$(openssl rand -hex 16)
EOF

# Update frontend API config for ingress support
bashio::log.info "Configuring frontend..."
cat > /app/frontend/js/config.js << EOF
// API configuration
const API_CONFIG = {
    baseURL: window.location.pathname.includes('/api/hassio_ingress/') 
        ? window.location.pathname.split('/api/hassio_ingress/')[0] + '/api'
        : '/api',
    timeout: 10000
};
EOF

# Start Nginx
bashio::log.info "Starting Nginx..."
nginx

# Start Node.js backend
bashio::log.info "Starting backend server..."
cd /app/backend
exec node server.js
