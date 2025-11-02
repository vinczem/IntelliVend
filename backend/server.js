require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./config/database');
const logger = require('./config/logger');
const mqttClient = require('./config/mqtt');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
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
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: logger.stream }));

// Routes
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/pumps', require('./routes/pumps'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/dispense', require('./routes/dispense'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/email', require('./routes/email'));

// Maintenance routes with MQTT client injection
const maintenanceRoutes = require('./routes/maintenance');
maintenanceRoutes.setMqttClient(mqttClient);
app.use('/api/maintenance', maintenanceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  db.query('SELECT 1', (err) => {
    if (err) {
      logger.error('Database health check failed:', err);
      return res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
    }
    res.json({ status: 'healthy', database: 'connected', version: '1.0.0' });
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
server.listen(PORT, () => {
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
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    mqttClient.disconnect();
    db.end(() => {
      logger.info('Database connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
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
