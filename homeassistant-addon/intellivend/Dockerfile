ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js and dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    nginx \
    mysql-client \
    curl

# Set working directory
WORKDIR /app

# Copy backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

COPY backend/ ./
RUN mkdir -p logs

# Copy frontend
WORKDIR /app
COPY frontend/ ./frontend/

# Copy nginx configuration
COPY homeassistant-addon/intellivend/nginx.conf /etc/nginx/http.d/default.conf

# Copy run script
COPY homeassistant-addon/intellivend/run.sh /
RUN chmod +x /run.sh

# Expose ports
EXPOSE 8099 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:3000/health || exit 1

# Run
CMD ["/run.sh"]
