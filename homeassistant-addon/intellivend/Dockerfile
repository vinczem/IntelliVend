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
    bash \
    openssl

# Set working directory
WORKDIR /tmp

# Clone repository with cache busting
# Add build arg to force fresh clone on each build
ARG BUILD_DATE
ARG VERSION
RUN echo "Build date: ${BUILD_DATE}" && \
    echo "Version: ${VERSION}" && \
    rm -rf /tmp/repo 2>/dev/null || true && \
    git clone --depth 1 --branch main https://github.com/vinczem/IntelliVend.git repo && \
    cd repo && \
    git log -1 --oneline

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

# Copy MySQL configuration
COPY my.cnf /etc/my.cnf

# Setup s6-overlay v3 service
RUN mkdir -p /etc/s6-overlay/s6-rc.d/intellivend && \
    mkdir -p /etc/s6-overlay/s6-rc.d/user/contents.d

# Copy main run script
COPY run.sh /etc/s6-overlay/s6-rc.d/intellivend/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/intellivend/run && \
    echo "longrun" > /etc/s6-overlay/s6-rc.d/intellivend/type

# Enable the service
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/intellivend

# Cleanup
RUN rm -rf /tmp/repo

# Expose ports
EXPOSE 8099 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:3000/health || exit 1
