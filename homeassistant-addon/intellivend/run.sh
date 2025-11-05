#!/usr/bin/with-contenv bashio

bashio::log.info "================================"
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Starting IntelliVend Add-on..."
bashio::log.info "================================"

# Ensure MySQL run directory exists
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Creating MySQL runtime directories..."
mkdir -p /run/mysqld
chown -R mysql:mysql /run/mysqld

# Ensure MySQL data directory exists
if ! test -d "/data/mysql"; then
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Creating MySQL data directory..."
    mkdir -p /data/mysql
    chown -R mysql:mysql /data/mysql
else
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL data directory exists."
fi

# Initialize MySQL if not already done
if ! test -d "/data/mysql/mysql"; then
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Initializing MySQL database..."
    
    # Initialize MySQL data directory
    mysql_install_db --user=mysql --datadir=/data/mysql > /dev/null 2>&1
    
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Starting temporary MySQL for setup..."
    mysqld --defaults-file=/etc/my.cnf --user=mysql --skip-networking &
    MYSQL_INIT_PID=$!
    
    # Wait for MySQL to start
    timeout=30
    while test $timeout -gt 0; do
        if mysqladmin ping --silent 2>/dev/null; then
            break
        fi
        timeout=$((timeout - 1))
        sleep 1
    done
    
    if test $timeout -eq 0; then
        bashio::log.error "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL initialization failed!"
        kill $MYSQL_INIT_PID 2>/dev/null || true
        exit 1
    fi
    
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Setting up IntelliVend database..."
    
    # Create database and user
    mysql -e "CREATE DATABASE IF NOT EXISTS intellivend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -e "CREATE USER IF NOT EXISTS 'intellivend'@'localhost' IDENTIFIED BY 'intellivend';"
    mysql -e "GRANT ALL PRIVILEGES ON intellivend.* TO 'intellivend'@'localhost';"
    mysql -e "FLUSH PRIVILEGES;"
    
    # Import schema and seed data
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Loading database schema..."
    mysql intellivend < /app/database/schema.sql
    
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Loading sample data..."
    mysql intellivend < /app/database/seed.sql
    
    # Shutdown temporary MySQL
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Shutting down temporary MySQL..."
    mysqladmin shutdown
    wait $MYSQL_INIT_PID
    
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL initialization complete!"
else
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL database already initialized."
fi

# Start MySQL server
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Starting MySQL server..."
mysqld --defaults-file=/etc/my.cnf --user=mysql &
MYSQL_PID=$!

# Wait for MySQL to be ready
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting for MySQL to be ready..."
timeout=30
while [ $timeout -gt 0 ]; do
    if mysqladmin ping --silent 2>/dev/null; then
        break
    fi
    timeout=$((timeout - 1))
    sleep 1
done

if [ $timeout -eq 0 ]; then
    bashio::log.error "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL failed to start!"
    exit 1
fi

bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL is ready!"

# Get MQTT configuration
MQTT_BROKER=$(bashio::config 'mqtt_broker')
MQTT_PORT=$(bashio::config 'mqtt_port')
MQTT_USER=$(bashio::config 'mqtt_user')
MQTT_PASSWORD=$(bashio::config 'mqtt_password')
LOG_LEVEL=$(bashio::config 'log_level')

# Get Email configuration
SMTP_HOST=$(bashio::config 'smtp_host')
SMTP_PORT=$(bashio::config 'smtp_port')
SMTP_USER=$(bashio::config 'smtp_user')
SMTP_PASSWORD=$(bashio::config 'smtp_password')
ALERT_EMAIL=$(bashio::config 'alert_email')

# Create .env file for backend with local MySQL
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Configuring backend environment..."
cat > /app/backend/.env << EOF
NODE_ENV=production
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=intellivend
DB_USER=intellivend
DB_PASSWORD=intellivend

MQTT_BROKER=$MQTT_BROKER
MQTT_PORT=$MQTT_PORT
MQTT_USERNAME=$MQTT_USER
MQTT_PASSWORD=$MQTT_PASSWORD

SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASSWORD=$SMTP_PASSWORD
ALERT_EMAIL=$ALERT_EMAIL

LOG_LEVEL=$LOG_LEVEL

API_SECRET=$(openssl rand -hex 32)
ESP32_API_KEY=$(openssl rand -hex 16)
EOF

# Update frontend API config for ingress support
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Configuring frontend..."
cat > /app/frontend/js/config.js << 'EOF'
// API configuration
const API_CONFIG = {
    baseURL: (() => {
        // Check if we're running through Home Assistant Ingress
        const path = window.location.pathname;
        if (path.includes('/api/hassio_ingress/')) {
            // Extract ingress base path and append /api
            const ingressMatch = path.match(/^(\/api\/hassio_ingress\/[^\/]+)/);
            return ingressMatch ? ingressMatch[1] + '/api' : '/api';
        }
        return '/api';
    })(),
    timeout: 10000
};
EOF

# Stop any existing nginx processes
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping any existing Nginx processes..."
pkill nginx 2>/dev/null || true
sleep 1

# Start Nginx
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Nginx..."
nginx

# Start Node.js backend
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backend server..."
cd /app/backend

# Run Node.js directly - output will go to supervisor
exec node server.js
