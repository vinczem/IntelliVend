const logger = require('../config/logger');
const mqttClient = require('../config/mqtt');

class HomeAssistantService {
    constructor() {
        this.discoveryPrefix = 'homeassistant';
        this.deviceInfo = {
            identifiers: ['intellivend'],
            name: 'IntelliVend',
            model: 'Smart Cocktail Dispenser',
            manufacturer: 'IntelliVend',
            sw_version: '1.0.0'
        };
    }

    /**
     * Initialize all Home Assistant entities via MQTT Discovery
     */
    async initializeDiscovery() {
        try {
            logger.info('Initializing Home Assistant MQTT Discovery...');

            // ESP32 Status Sensors
            await this.publishESP32Sensors();

            // Pump/Ingredient Sensors (will be updated dynamically)
            await this.publishPumpSensors();

            // Last Dispense Sensor
            await this.publishLastDispenseSensor();

            // Alert Binary Sensors
            await this.publishAlertSensors();

            logger.info('Home Assistant Discovery initialized');
        } catch (error) {
            logger.error('Error initializing HA Discovery:', error);
        }
    }

    /**
     * ESP32 Status Sensors
     */
    async publishESP32Sensors() {
        // WiFi Signal Strength
        await this.publishDiscovery('sensor', 'esp32_wifi', {
            name: 'IntelliVend ESP32 WiFi Signal',
            state_topic: 'intellivend/ha/esp32/wifi',
            unit_of_measurement: 'dBm',
            device_class: 'signal_strength',
            icon: 'mdi:wifi',
            value_template: '{{ value_json.rssi }}',
            json_attributes_topic: 'intellivend/ha/esp32/wifi'
        });

        // Memory Usage
        await this.publishDiscovery('sensor', 'esp32_memory', {
            name: 'IntelliVend ESP32 Memory Usage',
            state_topic: 'intellivend/ha/esp32/memory',
            unit_of_measurement: '%',
            icon: 'mdi:memory',
            value_template: '{{ value_json.usage_percent }}',
            json_attributes_topic: 'intellivend/ha/esp32/memory'
        });

        // Uptime
        await this.publishDiscovery('sensor', 'esp32_uptime', {
            name: 'IntelliVend ESP32 Uptime',
            state_topic: 'intellivend/ha/esp32/uptime',
            unit_of_measurement: 's',
            device_class: 'duration',
            icon: 'mdi:timer-outline',
            value_template: '{{ value_json.uptime_s }}',
            json_attributes_topic: 'intellivend/ha/esp32/uptime'
        });

        // Active Pumps
        await this.publishDiscovery('sensor', 'esp32_active_pumps', {
            name: 'IntelliVend ESP32 Active Pumps',
            state_topic: 'intellivend/ha/esp32/active_pumps',
            icon: 'mdi:pump',
            value_template: '{{ value_json.count }}',
            json_attributes_topic: 'intellivend/ha/esp32/active_pumps'
        });

        // Connection Status (Binary Sensor)
        await this.publishDiscovery('binary_sensor', 'esp32_online', {
            name: 'IntelliVend ESP32 Connection',
            state_topic: 'intellivend/ha/esp32/status',
            device_class: 'connectivity',
            payload_on: 'online',
            payload_off: 'offline',
            value_template: '{{ value_json.status }}'
        });
    }

    /**
     * Pump/Ingredient Sensors (8 pumps)
     */
    async publishPumpSensors() {
        for (let pumpId = 1; pumpId <= 8; pumpId++) {
            // Ingredient Level Sensor
            await this.publishDiscovery('sensor', `pump_${pumpId}_level`, {
                name: `IntelliVend Pump ${pumpId} Level`,
                state_topic: `intellivend/ha/pump/${pumpId}/level`,
                unit_of_measurement: 'ml',
                icon: 'mdi:cup-water',
                value_template: '{{ value_json.current_ml }}',
                json_attributes_topic: `intellivend/ha/pump/${pumpId}/level`
            });

            // Low Stock Alert (Binary Sensor)
            await this.publishDiscovery('binary_sensor', `pump_${pumpId}_low_stock`, {
                name: `IntelliVend Pump ${pumpId} Low Stock`,
                state_topic: `intellivend/ha/pump/${pumpId}/alert`,
                device_class: 'problem',
                payload_on: 'low',
                payload_off: 'ok',
                value_template: '{{ value_json.alert_status }}'
            });

            // Empty Alert (Binary Sensor)
            await this.publishDiscovery('binary_sensor', `pump_${pumpId}_empty`, {
                name: `IntelliVend Pump ${pumpId} Empty`,
                state_topic: `intellivend/ha/pump/${pumpId}/alert`,
                device_class: 'problem',
                payload_on: 'empty',
                payload_off: 'ok',
                value_template: '{{ value_json.empty_status }}'
            });
        }
    }

    /**
     * Last Dispense Sensor
     */
    async publishLastDispenseSensor() {
        await this.publishDiscovery('sensor', 'last_dispense', {
            name: 'IntelliVend Last Dispensed Drink',
            state_topic: 'intellivend/ha/last_dispense',
            icon: 'mdi:glass-cocktail',
            value_template: '{{ value_json.recipe_name }}',
            json_attributes_topic: 'intellivend/ha/last_dispense'
        });
    }

    /**
     * System Alert Sensors
     */
    async publishAlertSensors() {
        // Any Low Stock Alert
        await this.publishDiscovery('binary_sensor', 'system_low_stock', {
            name: 'IntelliVend System Low Stock Alert',
            state_topic: 'intellivend/ha/alerts/low_stock',
            device_class: 'problem',
            payload_on: 'true',
            payload_off: 'false',
            value_template: '{{ value_json.has_low_stock }}'
        });

        // Any Empty Bottle Alert
        await this.publishDiscovery('binary_sensor', 'system_empty_bottle', {
            name: 'IntelliVend System Empty Bottle Alert',
            state_topic: 'intellivend/ha/alerts/empty_bottle',
            device_class: 'problem',
            payload_on: 'true',
            payload_off: 'false',
            value_template: '{{ value_json.has_empty_bottle }}'
        });
    }

    /**
     * Publish MQTT Discovery message
     */
    async publishDiscovery(component, objectId, config) {
        const topic = `${this.discoveryPrefix}/${component}/intellivend/${objectId}/config`;
        
        const payload = {
            ...config,
            unique_id: `intellivend_${objectId}`,
            device: this.deviceInfo,
            availability: {
                topic: 'intellivend/ha/availability',
                payload_available: 'online',
                payload_not_available: 'offline'
            }
        };

        await mqttClient.publish(topic, payload, { retain: true });
        logger.debug(`Published HA Discovery: ${component}/${objectId}`);
    }

    /**
     * Update ESP32 status
     */
    async updateESP32Status(heartbeatData) {
        const memUsage = Math.round((1 - heartbeatData.free_heap / heartbeatData.total_heap) * 100);
        const uptimeSeconds = Math.floor(heartbeatData.uptime_ms / 1000);

        // WiFi Signal
        await mqttClient.publish('intellivend/ha/esp32/wifi', {
            rssi: heartbeatData.wifi_rssi,
            quality: this.getWiFiQuality(heartbeatData.wifi_rssi)
        });

        // Memory Usage
        await mqttClient.publish('intellivend/ha/esp32/memory', {
            usage_percent: memUsage,
            free_heap: heartbeatData.free_heap,
            total_heap: heartbeatData.total_heap
        });

        // Uptime
        await mqttClient.publish('intellivend/ha/esp32/uptime', {
            uptime_s: uptimeSeconds,
            uptime_formatted: this.formatUptime(uptimeSeconds),
            firmware_version: heartbeatData.firmware_version
        });

        // Active Pumps
        await mqttClient.publish('intellivend/ha/esp32/active_pumps', {
            count: heartbeatData.pumps_active || 0
        });

        // Connection Status
        await mqttClient.publish('intellivend/ha/esp32/status', {
            status: 'online',
            last_seen: new Date().toISOString()
        });
    }

    /**
     * Update pump/ingredient status
     */
    async updatePumpStatus(pumpId, ingredientData) {
        const { ingredient_name, current_quantity, bottle_size, is_alcoholic, min_quantity_alert } = ingredientData;
        
        const currentMl = current_quantity || 0;
        const maxMl = bottle_size || 0;
        const lowStockThreshold = min_quantity_alert || 100;
        const percentage = maxMl > 0 ? Math.round((currentMl / maxMl) * 100) : 0;
        const isLow = currentMl <= lowStockThreshold;
        const isEmpty = currentMl <= 0;

        // Level sensor
        await mqttClient.publish(`intellivend/ha/pump/${pumpId}/level`, {
            current_ml: currentMl,
            max_ml: maxMl,
            percentage,
            ingredient_name: ingredient_name || `Pump ${pumpId}`,
            is_alcoholic: is_alcoholic || false
        });

        // Alert sensors
        await mqttClient.publish(`intellivend/ha/pump/${pumpId}/alert`, {
            alert_status: isLow && !isEmpty ? 'low' : 'ok',
            empty_status: isEmpty ? 'empty' : 'ok',
            threshold: lowStockThreshold
        });
    }

    /**
     * Update last dispense info
     */
    async updateLastDispense(dispenseData) {
        const { recipe_name, started_at, duration_seconds, total_ml } = dispenseData;

        await mqttClient.publish('intellivend/ha/last_dispense', {
            recipe_name,
            timestamp: started_at,
            duration_seconds,
            total_ml,
            time_ago: this.getTimeAgo(new Date(started_at))
        });
    }

    /**
     * Update system alerts
     */
    async updateSystemAlerts(pumps) {
        let hasLowStock = false;
        let hasEmptyBottle = false;

        pumps.forEach(pump => {
            const currentMl = pump.current_quantity || 0;
            const threshold = pump.min_quantity_alert || 100;
            
            if (currentMl <= 0) hasEmptyBottle = true;
            else if (currentMl <= threshold) hasLowStock = true;
        });

        await mqttClient.publish('intellivend/ha/alerts/low_stock', {
            has_low_stock: hasLowStock
        });

        await mqttClient.publish('intellivend/ha/alerts/empty_bottle', {
            has_empty_bottle: hasEmptyBottle
        });
    }

    /**
     * Set availability status
     */
    async setAvailable(online = true) {
        await mqttClient.publish('intellivend/ha/availability', online ? 'online' : 'offline', { retain: true });
    }

    /**
     * Remove all entities (on shutdown or uninstall)
     */
    async removeAllEntities() {
        logger.info('Removing Home Assistant entities...');
        
        const components = [
            { type: 'sensor', ids: ['esp32_wifi', 'esp32_memory', 'esp32_uptime', 'esp32_active_pumps', 'last_dispense'] },
            { type: 'binary_sensor', ids: ['esp32_online', 'system_low_stock', 'system_empty_bottle'] }
        ];

        // Remove ESP32 and system entities
        for (const comp of components) {
            for (const id of comp.ids) {
                const topic = `${this.discoveryPrefix}/${comp.type}/intellivend/${id}/config`;
                await mqttClient.publish(topic, '', { retain: true });
            }
        }

        // Remove pump entities
        for (let pumpId = 1; pumpId <= 8; pumpId++) {
            const pumpEntities = [
                `sensor/intellivend/pump_${pumpId}_level/config`,
                `binary_sensor/intellivend/pump_${pumpId}_low_stock/config`,
                `binary_sensor/intellivend/pump_${pumpId}_empty/config`
            ];

            for (const entity of pumpEntities) {
                await mqttClient.publish(`${this.discoveryPrefix}/${entity}`, '', { retain: true });
            }
        }

        await this.setAvailable(false);
        logger.info('✅ Home Assistant entities removed');
    }

    /**
     * Helper: Get WiFi quality from RSSI
     */
    getWiFiQuality(rssi) {
        if (rssi >= -50) return 'excellent';
        if (rssi >= -60) return 'good';
        if (rssi >= -70) return 'fair';
        if (rssi >= -80) return 'weak';
        return 'poor';
    }

    /**
     * Helper: Format uptime
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    /**
     * Helper: Get time ago string
     */
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
}

// Singleton instance
const haService = new HomeAssistantService();

module.exports = haService;
