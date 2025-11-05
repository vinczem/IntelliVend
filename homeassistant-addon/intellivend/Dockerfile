ARG BUILD_FROM
FROM $BUILD_FROM

# Install dependencies including MySQL server
RUN apk add --no-cache \
    nodejs \
    npm \
    nginx \
    mysql \
    mysql-client \
    curl \
    git \
    bash

# Set working directory
WORKDIR /tmp

# Clone repository
RUN git clone --depth 1 https://github.com/vinczem/IntelliVend.git repo

# Setup application directory
WORKDIR /app

# Install backend dependencies
RUN cp -r /tmp/repo/backend . && \
    cd backend && \
    npm ci --only=production && \
    mkdir -p logs

# Copy frontend
RUN cp -r /tmp/repo/frontend .

# Copy database files
RUN cp -r /tmp/repo/database .

# Setup MySQL data directory
RUN mkdir -p /data/mysql && \
    chown -R mysql:mysql /data/mysql

# Copy nginx configuration
RUN cp /tmp/repo/homeassistant-addon/intellivend/nginx.conf /etc/nginx/http.d/default.conf

# Setup s6-overlay v3 services for MySQL initialization
RUN mkdir -p /etc/s6-overlay/s6-rc.d/init-mysql && \
    mkdir -p /etc/s6-overlay/s6-rc.d/intellivend && \
    mkdir -p /etc/s6-overlay/s6-rc.d/user/contents.d

# Copy MySQL init script (oneshot service that runs before intellivend)
COPY init-mysql.sh /etc/s6-overlay/s6-rc.d/init-mysql/up
RUN chmod +x /etc/s6-overlay/s6-rc.d/init-mysql/up && \
    echo "oneshot" > /etc/s6-overlay/s6-rc.d/init-mysql/type

# Copy main run script
COPY run.sh /etc/s6-overlay/s6-rc.d/intellivend/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/intellivend/run

# Create service type file for main service
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/intellivend/type

# Make intellivend depend on init-mysql
RUN mkdir -p /etc/s6-overlay/s6-rc.d/intellivend/dependencies.d && \
    touch /etc/s6-overlay/s6-rc.d/intellivend/dependencies.d/init-mysql

# Enable the services
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/init-mysql && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/intellivend

# Cleanup
RUN rm -rf /tmp/repo

# Expose ports
EXPOSE 8099 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:3000/health || exit 1
