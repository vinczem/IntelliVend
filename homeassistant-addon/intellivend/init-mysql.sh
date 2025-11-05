#!/usr/bin/with-contenv bashio

# Initialize MySQL if not already done
if [ ! -d "/data/mysql/mysql" ]; then
    bashio::log.info "Initializing MySQL database..."
    
    # Initialize MySQL data directory
    mysql_install_db --user=mysql --datadir=/data/mysql > /dev/null
    
    # Start MySQL temporarily for setup
    mysqld --user=mysql --datadir=/data/mysql --skip-networking &
    MYSQL_PID=$!
    
    # Wait for MySQL to start
    timeout=30
    while [ $timeout -gt 0 ]; do
        if mysqladmin ping --silent 2>/dev/null; then
            break
        fi
        timeout=$((timeout - 1))
        sleep 1
    done
    
    if [ $timeout -eq 0 ]; then
        bashio::log.error "MySQL initialization failed!"
        kill $MYSQL_PID 2>/dev/null
        exit 1
    fi
    
    bashio::log.info "Setting up IntelliVend database..."
    
    # Create database and user
    mysql -e "CREATE DATABASE IF NOT EXISTS intellivend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -e "CREATE USER IF NOT EXISTS 'intellivend'@'localhost' IDENTIFIED BY 'intellivend';"
    mysql -e "GRANT ALL PRIVILEGES ON intellivend.* TO 'intellivend'@'localhost';"
    mysql -e "FLUSH PRIVILEGES;"
    
    # Import schema and seed data
    bashio::log.info "Loading database schema..."
    mysql intellivend < /app/database/schema.sql
    
    bashio::log.info "Loading sample data..."
    mysql intellivend < /app/database/seed.sql
    
    # Shutdown temporary MySQL
    mysqladmin shutdown
    wait $MYSQL_PID
    
    bashio::log.info "MySQL initialization complete!"
else
    bashio::log.info "MySQL database already initialized."
fi
