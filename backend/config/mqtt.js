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
      
      // Subscribe to ESP32 topics
      this.subscribe('intellivend/esp32/status');
      this.subscribe('intellivend/esp32/pump/+/status');
      this.subscribe('intellivend/dispense/feedback');
      this.subscribe('intellivend/sensor/+');
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

      // Default handlers
      if (topic === 'intellivend/esp32/status') {
        this.handleESP32Status(payload);
      } else if (topic.startsWith('intellivend/esp32/pump/')) {
        this.handlePumpStatus(topic, payload);
      } else if (topic === 'intellivend/dispense/feedback') {
        this.handleDispenseFeedback(payload);
      } else if (topic.startsWith('intellivend/sensor/')) {
        this.handleSensorData(topic, payload);
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

  handleESP32Status(payload) {
    logger.info('ESP32 Status:', payload);
    // TODO: Update database with ESP32 status
  }

  handlePumpStatus(topic, payload) {
    const pumpNumber = topic.split('/')[3];
    logger.info(`Pump ${pumpNumber} status:`, payload);
    // TODO: Update pump status in database
  }

  handleDispenseFeedback(payload) {
    logger.info('Dispense feedback:', payload);
    // TODO: Update dispensing_log status
  }

  handleSensorData(topic, payload) {
    const sensorId = topic.split('/')[2];
    logger.debug(`Sensor ${sensorId} data:`, payload);
    // TODO: Process sensor data (flow meters, etc.)
  }

  // Commands to ESP32
  async commandDispense(logId, commands) {
    const message = {
      log_id: logId,
      timestamp: Date.now(),
      commands: commands
    };

    await this.publish('intellivend/dispense/command', message);
    logger.info(`Dispense command sent for log_id: ${logId}`);
  }

  async commandPump(pumpNumber, action, duration = 0) {
    const message = {
      action: action, // 'start', 'stop', 'test'
      duration: duration,
      timestamp: Date.now()
    };

    await this.publish(`intellivend/pump/${pumpNumber}/control`, message);
    logger.info(`Pump ${pumpNumber} command: ${action}`);
  }

  async publishInventoryUpdate(inventory) {
    await this.publish('intellivend/inventory/status', inventory, { retain: true });
  }

  async publishAlert(alert) {
    await this.publish('intellivend/alerts', alert);
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
