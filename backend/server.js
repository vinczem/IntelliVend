// Load .env only in development (Docker uses environment variables directly)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const db = require('./config/database');
const logger = require('./config/logger');
const mqttClient = require('./config/mqtt');
const haService = require('./services/homeassistantService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for local network access
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Initialize MQTT connection
if (process.env.MQTT_BROKER) {
  mqttClient.connect();
  logger.info('MQTT client initialization started');
} else {
  logger.warn('MQTT broker not configured, MQTT features disabled');
}

// Middleware
app.use(cors()); // CORS először!

// Disable CSP for Swagger docs to allow inline scripts
app.use((req, res, next) => {
  if (req.path.startsWith('/api/docs')) {
    // No helmet for Swagger docs
    next();
  } else {
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })(req, res, next);
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: logger.stream }));

// Ensure all JSON responses use utf-8 charset
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/docs')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

// Static file serving for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve custom Swagger initialization script
app.use('/api/docs/js', express.static(path.join(__dirname, 'public')));

// Swagger API Documentation
const swaggerUiAssetPath = require('swagger-ui-dist').getAbsoluteFSPath();
app.use('/api/docs/swagger-ui-dist', express.static(swaggerUiAssetPath));

app.get('/api/docs', (req, res) => {
  res.type('html');
  res.send(
    '<!DOCTYPE html>' +
    '<html lang="en">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<title>IntelliVend API Documentation</title>' +
    '<link rel="stylesheet" type="text/css" href="/api/docs/swagger-ui-dist/swagger-ui.css" />' +
    '<link rel="icon" type="image/png" href="/api/docs/swagger-ui-dist/favicon-32x32.png" sizes="32x32" />' +
    '<link rel="icon" type="image/png" href="/api/docs/swagger-ui-dist/favicon-16x16.png" sizes="16x16" />' +
    '<style>' +
    'html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }' +
    '*, *:before, *:after { box-sizing: inherit; }' +
    'body { margin:0; background: #fafafa; }' +
    '.swagger-ui .topbar { display: none }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div id="swagger-ui"></div>' +
    '<script src="/api/docs/swagger-ui-dist/swagger-ui-bundle.js" charset="UTF-8"></script>' +
    '<script src="/api/docs/swagger-ui-dist/swagger-ui-standalone-preset.js" charset="UTF-8"></script>' +
    '<script src="/api/docs/js/swagger-init.js" charset="UTF-8"></script>' +
    '</body>' +
    '</html>'
  );
});

app.get('/api/docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/pumps', require('./routes/pumps'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/dispense', require('./routes/dispense'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/email', require('./routes/email'));
app.use('/api/backup', require('./routes/backup'));

// Maintenance routes with MQTT client injection
const maintenanceRoutes = require('./routes/maintenance');
maintenanceRoutes.setMqttClient(mqttClient);
app.use('/api/maintenance', maintenanceRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Ellenőrzi a rendszer és az adatbázis kapcsolat állapotát
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Rendszer működik
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 database:
 *                   type: string
 *                   example: connected
 *                 version:
 *                   type: string
 *                   example: 1.0.17
 *       503:
 *         description: Rendszer nem elérhető
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *                 database:
 *                   type: string
 *                   example: disconnected
 */
// Health check endpoint
app.get('/health', (req, res) => {
  db.query('SELECT 1', (err) => {
    if (err) {
      logger.error('Database health check failed:', err);
      return res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
    }
    res.json({ status: 'healthy', database: 'connected', version: '1.0.17' });
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'IntelliVend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      ingredients: '/api/ingredients',
      pumps: '/api/pumps',
      recipes: '/api/recipes',
      inventory: '/api/inventory',
      dispense: '/api/dispense',
      alerts: '/api/alerts',
      stats: '/api/stats',
      email: '/api/email',
      maintenance: '/api/maintenance',
      health: '/health'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`WebSocket client disconnected: ${socket.id}`);
  });
});

// Make io available to routes via app.locals
app.locals.io = io;

// Pass io to MQTT client for broadcasting
mqttClient.setWebSocket(io);

// Server indítása
server.listen(PORT, async () => {
  logger.info(`IntelliVend API server listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`MQTT: ${mqttClient.isConnected() ? 'Connected' : 'Disabled'}`);
  logger.info(`WebSocket: Ready`);
  
  // Create email_notifications table if it doesn't exist
  const createEmailTableQuery = `
    CREATE TABLE IF NOT EXISTS email_notifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      alert_id INT NOT NULL,
      email_type ENUM('low_stock', 'empty_bottle', 'summary') NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('sent', 'failed') DEFAULT 'sent',
      error_message TEXT,
      INDEX idx_alert_id (alert_id),
      INDEX idx_sent_at (sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;
  
  db.query(createEmailTableQuery, (err) => {
    if (err) {
      logger.error('Error creating email_notifications table:', err);
    } else {
      logger.info('📧 Email notifications table ready');
    }
  });
  
  // Create maintenance_log table if it doesn't exist
  const createMaintenanceTableQuery = `
    CREATE TABLE IF NOT EXISTS maintenance_log (
      id INT PRIMARY KEY AUTO_INCREMENT,
      pump_id INT NOT NULL,
      action_type ENUM('flush', 'calibration', 'repair', 'other') NOT NULL DEFAULT 'flush',
      duration_ms INT DEFAULT NULL COMMENT 'Duration in milliseconds (for flush/calibration)',
      notes TEXT DEFAULT NULL COMMENT 'Additional notes or error messages',
      performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pump_id) REFERENCES pumps(id) ON DELETE CASCADE,
      INDEX idx_pump_id (pump_id),
      INDEX idx_performed_at (performed_at),
      INDEX idx_action_type (action_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;
  
  db.query(createMaintenanceTableQuery, (err) => {
    if (err) {
      logger.error('Error creating maintenance_log table:', err);
    } else {
      logger.info('🔧 Maintenance log table ready');
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  
  // Set HA availability to offline
  if (mqttClient.isConnected()) {
    await haService.setAvailable(false);
  }
  
  server.close(() => {
    logger.info('HTTP server closed');
    mqttClient.disconnect();
    db.end(() => {
      logger.info('Database connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  
  // Set HA availability to offline
  if (mqttClient.isConnected()) {
    await haService.setAvailable(false);
  }
  
  server.close(() => {
    logger.info('HTTP server closed');
    mqttClient.disconnect();
    db.end(() => {
      logger.info('Database connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;
