#!/usr/bin/with-contenv bashio

# Enable error handling
set -e

bashio::log.info "Starting IntelliVend Add-on..."

# Start MySQL server
bashio::log.info "Starting MySQL server..."
mysqld --user=mysql --datadir=/data/mysql &
MYSQL_PID=$!

# Wait for MySQL to be ready
bashio::log.info "Waiting for MySQL to be ready..."
for i in {30..0}; do
    if mysqladmin ping --silent 2>/dev/null; then
        break
    fi
    sleep 1
done

if [ "$i" = 0 ]; then
    bashio::log.error "MySQL failed to start!"
    exit 1
fi

bashio::log.info "MySQL is ready!"

# Get MQTT configuration
MQTT_BROKER=$(bashio::config 'mqtt_broker')
MQTT_PORT=$(bashio::config 'mqtt_port')
MQTT_USER=$(bashio::config 'mqtt_user')
MQTT_PASSWORD=$(bashio::config 'mqtt_password')
LOG_LEVEL=$(bashio::config 'log_level')

# Create .env file for backend with local MySQL
bashio::log.info "Configuring backend environment..."
cat > /app/backend/.env << EOF
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=intellivend
DB_USER=intellivend
DB_PASSWORD=intellivend

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
