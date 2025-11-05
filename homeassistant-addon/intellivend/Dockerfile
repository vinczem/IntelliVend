ARG BUILD_FROM
FROM $BUILD_FROM

# Install dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    nginx \
    mysql-client \
    curl \
    git

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

# Copy nginx configuration
RUN cp /tmp/repo/homeassistant-addon/intellivend/nginx.conf /etc/nginx/http.d/default.conf

# Copy and setup run script for s6-overlay
RUN mkdir -p /etc/services.d/intellivend && \
    cp /tmp/repo/homeassistant-addon/intellivend/run.sh /etc/services.d/intellivend/run && \
    chmod +x /etc/services.d/intellivend/run

# Cleanup
RUN rm -rf /tmp/repo

# Expose ports
EXPOSE 8099 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:3000/health || exit 1
