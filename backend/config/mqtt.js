const mqtt = require('mqtt');
const logger = require('./logger');

// Lazy load to avoid circular dependency
let haService = null;
const getHAService = () => {
  if (!haService) {
    haService = require('../services/homeassistantService');
  }
  return haService;
};

class MQTTClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscribers = new Map();
    this.io = null; // WebSocket instance
  }
  
  setWebSocket(io) {
    this.io = io;
    logger.info('WebSocket instance attached to MQTT client');
  }

  connect() {
    const options = {
      host: process.env.MQTT_BROKER || 'localhost',
      port: parseInt(process.env.MQTT_PORT) || 1883,
      username: process.env.MQTT_USERNAME || '',
      password: process.env.MQTT_PASSWORD || '',
      clientId: `intellivend_backend_${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000
    };

    logger.info(`Connecting to MQTT broker at ${options.host}:${options.port}`);

    this.client = mqtt.connect(options);

    this.client.on('connect', () => {
      this.connected = true;
      logger.info('MQTT connected successfully');
      
      // Subscribe to ESP32 topics (new unified structure)
      this.subscribe('intellivend/status');                    // Real-time pump status updates
      this.subscribe('intellivend/dispense/complete');         // Dispense completion
      this.subscribe('intellivend/maintenance/complete');      // Maintenance completion
      this.subscribe('intellivend/error');                     // Error messages
      this.subscribe('intellivend/heartbeat');                 // ESP32 health status
      
      // Initialize Home Assistant MQTT Discovery
      this.initializeHomeAssistant();
    });

    this.client.on('error', (error) => {
      logger.error('MQTT connection error:', error);
      this.connected = false;
    });

    this.client.on('offline', () => {
      logger.warn('MQTT client offline');
      this.connected = false;
    });

    this.client.on('reconnect', () => {
      logger.info('MQTT reconnecting...');
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    return this.client;
  }

  subscribe(topic, callback) {
    if (!this.client) {
      logger.error('MQTT client not initialized');
      return;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        logger.error(`Failed to subscribe to ${topic}:`, err);
      } else {
        logger.info(`Subscribed to MQTT topic: ${topic}`);
        if (callback) {
          this.subscribers.set(topic, callback);
        }
      }
    });
  }

  publish(topic, message, options = {}) {
    if (!this.client || !this.connected) {
      logger.error('MQTT client not connected');
      return Promise.reject(new Error('MQTT not connected'));
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);

    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, { qos: options.qos || 1, retain: options.retain || false }, (err) => {
        if (err) {
          logger.error(`Failed to publish to ${topic}:`, err);
          reject(err);
        } else {
          logger.debug(`Published to ${topic}: ${payload}`);
          resolve();
        }
      });
    });
  }

  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      logger.debug(`MQTT message received on ${topic}:`, payload);

      // Check for registered subscribers
      const subscriber = this.subscribers.get(topic);
      if (subscriber) {
        subscriber(payload);
        return;
      }

      // Handle wildcard topics
      for (const [subscribedTopic, callback] of this.subscribers.entries()) {
        if (this.matchTopic(subscribedTopic, topic)) {
          callback(payload);
          return;
        }
      }

      // Default handlers (new unified structure)
      if (topic === 'intellivend/status') {
        this.handleStatus(payload);
      } else if (topic === 'intellivend/dispense/complete') {
        this.handleDispenseComplete(payload);
      } else if (topic === 'intellivend/maintenance/complete') {
        this.handleMaintenanceComplete(payload);
      } else if (topic === 'intellivend/error') {
        this.handleError(payload);
      } else if (topic === 'intellivend/heartbeat') {
        this.handleHeartbeat(payload);
      }
    } catch (error) {
      logger.error(`Error handling MQTT message from ${topic}:`, error);
    }
  }

  matchTopic(pattern, topic) {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    if (patternParts.length !== topicParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '+') {
        continue;
      }
      if (patternParts[i] === '#') {
        return true;
      }
      if (patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return true;
  }

  handleStatus(payload) {
    // Real-time pump status update during dispensing
    logger.debug(`Pump ${payload.pump_id} status:`, {
      state: payload.state,
      progress: `${payload.progress_ml}/${payload.target_ml} ml`
    });
    
    // WebSocket broadcast to frontend for real-time progress bar
    if (this.io) {
      this.io.emit('dispense:status', payload);
    }
  }

  handleDispenseComplete(payload) {
    logger.info(`Pump ${payload.pump_id} dispense complete:`, {
      actual: payload.actual_ml,
      requested: payload.requested_ml,
      duration: payload.duration_ms
    });
    
    // WebSocket broadcast
    if (this.io) {
      this.io.emit('dispense:complete', payload);
    }
    
    // Update database - mark dispensing_log as completed
    const db = require('./database');
    
    // Find the most recent 'started' dispensing log
    const findLogQuery = `
      SELECT id FROM dispensing_log 
      WHERE status = 'started' 
      ORDER BY started_at DESC 
      LIMIT 1
    `;
    
    db.query(findLogQuery, (err, results) => {
      if (err) {
        logger.error('Error finding dispensing log:', err);
        return;
      }
      
      if (results.length === 0) {
        logger.warn('No started dispensing log found to complete');
        return;
      }
      
      const logId = results[0].id;
      
      // Update status to completed
      // Note: duration in seconds, not ms
      const durationSeconds = Math.round(payload.duration_ms / 1000);
      
      const updateQuery = `
        UPDATE dispensing_log 
        SET status = 'completed',
            duration_seconds = ?,
            completed_at = NOW()
        WHERE id = ?
      `;
      
      db.query(updateQuery, [durationSeconds, logId], (updateErr) => {
        if (updateErr) {
          logger.error('Error updating dispensing log:', updateErr);
        } else {
          logger.info(`Dispensing log ${logId} marked as completed (${durationSeconds}s)`);
          
          // Update Home Assistant last dispense sensor
          db.query(`
            SELECT recipe_name, started_at, duration_seconds, total_volume_ml
            FROM dispensing_log
            WHERE id = ?
          `, [logId], async (err, results) => {
            if (!err && results && results.length > 0) {
              const ha = getHAService();
              if (ha) {
                await ha.updateLastDispense(results[0]);
                logger.debug('HA last dispense sensor updated');
              }
            }
          });
        }
      });
    });
  }

  handleMaintenanceComplete(payload) {
    logger.info(`Maintenance complete on pump ${payload.pump_id}:`, {
      action: payload.action_type,
      duration: payload.duration_ms
    });
    
    // WebSocket broadcast
    if (this.io) {
      this.io.emit('maintenance:complete', payload);
    }
    
    // TODO: Update maintenance_log in database
  }

  handleError(payload) {
    logger.error(`ESP32 Error [${payload.error_code}]:`, {
      pump: payload.pump_id,
      severity: payload.severity,
      message: payload.message
    });
    
    // WebSocket broadcast
    if (this.io) {
      this.io.emit('esp32:error', payload);
    }
    
    // TODO: Create alert in database
    // TODO: Send email if severity === 'critical'
  }

  handleHeartbeat(payload) {
    logger.debug('ESP32 Heartbeat:', {
      uptime: Math.floor(payload.uptime_ms / 1000) + 's',
      wifi: payload.wifi_rssi + ' dBm',
      memory: Math.floor((1 - payload.free_heap / payload.total_heap) * 100) + '%'
    });
    
    // WebSocket broadcast (for ESP32 online/offline indicator)
    if (this.io) {
      this.io.emit('esp32:heartbeat', {
        uptime_ms: payload.uptime_ms,
        wifi_rssi: payload.wifi_rssi,
        memory_used_percent: Math.floor((1 - payload.free_heap / payload.total_heap) * 100),
        pumps_active: payload.pumps_active,
        firmware_version: payload.firmware_version,
        timestamp: payload.timestamp
      });
    }
    
    // Update Home Assistant
    try {
      getHAService().updateESP32Status(payload);
    } catch (error) {
      logger.debug('HA service not ready yet:', error.message);
    }
    
    // Check WiFi signal
    if (payload.wifi_rssi < -80) {
      logger.warn('ESP32 WiFi signal weak!');
    }
    
    // Check memory usage
    const memUsage = (1 - payload.free_heap / payload.total_heap) * 100;
    if (memUsage > 90) {
      logger.warn(`ESP32 low memory: ${memUsage.toFixed(1)}% used`);
    }
    
    // TODO: Store last heartbeat timestamp for offline detection
  }

  // Commands to ESP32 (new unified structure)
  async commandDispense(pumpId, amountML, durationMS, recipeName = '') {
    const message = {
      pump_id: pumpId,
      amount_ml: amountML,
      duration_ms: durationMS,
      recipe_name: recipeName,
      timestamp: new Date().toISOString()
    };

    await this.publish('intellivend/dispense/command', message);
    logger.info(`Dispense command sent: Pump ${pumpId}, ${amountML}ml`);
  }

  async commandFlush(pumpId, durationMS) {
    const message = {
      pump_id: pumpId,  // -1 for all pumps
      duration_ms: durationMS
    };

    await this.publish('intellivend/maintenance/flush', message);
    logger.info(`Flush command sent: Pump ${pumpId}, ${durationMS}ms`);
  }

  async commandCalibration(pumpId, testAmountML, timeoutMS = 30000) {
    const message = {
      pump_id: pumpId,
      test_amount_ml: testAmountML,
      timeout_ms: timeoutMS
    };

    await this.publish('intellivend/calibration/start', message);
    logger.info(`Calibration started: Pump ${pumpId}, ${testAmountML}ml`);
  }

  async commandEmergencyStop(reason = 'User initiated') {
    const message = {
      reason: reason,
      timestamp: new Date().toISOString()
    };

    await this.publish('intellivend/emergency/stop', message, { qos: 2 });
    logger.warn(`Emergency stop commanded: ${reason}`);
  }

  async initializeHomeAssistant() {
    try {
      // Import db here to avoid circular dependency
      const db = require('./database');
      const haService = getHAService();
      
      logger.info('Initializing Home Assistant integration...');
      
      // Set availability
      await haService.setAvailable(true);
      
      // Initialize discovery
      await haService.initializeDiscovery();
      
      // Initial pump status update
      db.query(`
        SELECT p.id as pump_id, inv.current_quantity, inv.bottle_size, inv.min_quantity_alert,
               i.name as ingredient_name, i.alcohol_percentage > 0 as is_alcoholic
        FROM pumps p
        LEFT JOIN inventory inv ON p.id = inv.pump_id
        LEFT JOIN ingredients i ON p.ingredient_id = i.id
      `, async (err, pumps) => {
        if (err) {
          logger.error('❌ Error fetching pump data for HA:', err);
        } else if (pumps && pumps.length > 0) {
          logger.info(`Updating ${pumps.length} pump sensors...`);
          for (const pump of pumps) {
            await haService.updatePumpStatus(pump.pump_id, pump);
          }
          await haService.updateSystemAlerts(pumps);
        } else {
          logger.warn('No pump data found in database');
        }
        
        // Update last dispense sensor with most recent completed dispense
        db.query(`
          SELECT recipe_name, started_at, duration_seconds, total_volume_ml
          FROM dispensing_log
          WHERE status = 'completed'
          ORDER BY completed_at DESC
          LIMIT 1
        `, async (err, results) => {
          if (err) {
            logger.error('❌ Error fetching last dispense:', err);
          } else if (results && results.length > 0) {
            await haService.updateLastDispense(results[0]);
            logger.info('Last dispense sensor updated');
          } else {
            logger.info('No completed dispenses found');
          }
          logger.info('Home Assistant integration initialized');
        });
      });
    } catch (error) {
      logger.error('❌ Error initializing Home Assistant:', error);
    }
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.connected = false;
      logger.info('MQTT disconnected');
    }
  }

  isConnected() {
    return this.connected;
  }
}

// Singleton instance
const mqttClient = new MQTTClient();

module.exports = mqttClient;
