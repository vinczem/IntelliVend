const mqtt = require('mqtt');
const logger = require('./logger');

class MQTTClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscribers = new Map();
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
    // TODO: WebSocket broadcast to frontend for real-time progress bar
    // io.emit('dispensing-progress', payload);
  }

  handleDispenseComplete(payload) {
    logger.info(`Pump ${payload.pump_id} dispense complete:`, {
      actual: payload.actual_ml,
      target: payload.target_ml,
      duration: payload.duration_ms
    });
    
    // TODO: Update dispensing_log in database
    // TODO: Update inventory (subtract actual_ml)
    // TODO: Check for low stock alerts
  }

  handleMaintenanceComplete(payload) {
    logger.info(`Maintenance complete on pump ${payload.pump_id}:`, {
      action: payload.action_type,
      duration: payload.duration_ms
    });
    
    // TODO: Update maintenance_log in database
  }

  handleError(payload) {
    logger.error(`ESP32 Error [${payload.error_code}]:`, {
      pump: payload.pump_id,
      severity: payload.severity,
      message: payload.message
    });
    
    // TODO: Create alert in database
    // TODO: Send email if severity === 'critical'
    // TODO: WebSocket notification to frontend
  }

  handleHeartbeat(payload) {
    logger.debug('ESP32 Heartbeat:', {
      uptime: Math.floor(payload.uptime_ms / 1000) + 's',
      wifi: payload.wifi_rssi + ' dBm',
      memory: Math.floor((1 - payload.free_heap / payload.total_heap) * 100) + '%'
    });
    
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
