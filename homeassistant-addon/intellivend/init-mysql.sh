#!/usr/bin/with-contenv bashio

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting MySQL initialization check..." >&2
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Starting MySQL initialization check..."

# Ensure MySQL data directory exists
if ! test -d "/data/mysql"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating MySQL data directory..." >&2
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Creating MySQL data directory..."
    mkdir -p /data/mysql
    chown -R mysql:mysql /data/mysql
fi

# Initialize MySQL if not already done
if ! test -d "/data/mysql/mysql"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL not initialized, starting initialization..." >&2
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Initializing MySQL database..."
    
    # Initialize MySQL data directory
    mysql_install_db --user=mysql --datadir=/data/mysql > /dev/null 2>&1
    
    # Start MySQL temporarily for setup
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] Starting temporary MySQL server..."
    mysqld --user=mysql --datadir=/data/mysql --skip-networking &
    MYSQL_PID=$!
    
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
        kill $MYSQL_PID 2>/dev/null || true
        exit 1
    fi
    
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL started, setting up IntelliVend database..."
    
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
    wait $MYSQL_PID
    
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL initialization complete!"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL already initialized." >&2
    bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL database already initialized."
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL init script finished successfully." >&2
bashio::log.info "[$(date '+%Y-%m-%d %H:%M:%S')] MySQL init script finished successfully."
exit 0
