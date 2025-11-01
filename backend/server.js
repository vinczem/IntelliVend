require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./config/database');
const logger = require('./config/logger');
const mqttClient = require('./config/mqtt');

const app = express();
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

// Server indítása
const server = app.listen(PORT, () => {
  logger.info(`IntelliVend API server listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`MQTT: ${mqttClient.isConnected() ? 'Connected' : 'Disabled'}`);
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
