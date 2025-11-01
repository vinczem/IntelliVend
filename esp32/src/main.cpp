/*
 * IntelliVend ESP32 Firmware
 * 
 * Main firmware file for IntelliVend cocktail dispenser
 * Controls pumps via MQTT commands from Home Assistant
 * 
 * Author: IntelliVend Team
 * Version: 1.0.0
 * Date: 2025-11-01
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

// WiFi and MQTT clients
WiFiClient espClient;
PubSubClient mqtt(espClient);

// Pump configuration
const int NUM_PUMPS = 8;
const int pumpPins[NUM_PUMPS] = {
  PUMP_1_PIN, PUMP_2_PIN, PUMP_3_PIN, PUMP_4_PIN,
  PUMP_5_PIN, PUMP_6_PIN, PUMP_7_PIN, PUMP_8_PIN
};

float pumpCalibration[NUM_PUMPS] = {
  PUMP_1_CALIBRATION, PUMP_2_CALIBRATION, PUMP_3_CALIBRATION, PUMP_4_CALIBRATION,
  PUMP_5_CALIBRATION, PUMP_6_CALIBRATION, PUMP_7_CALIBRATION, PUMP_8_CALIBRATION
};

// System state
unsigned long lastHeartbeat = 0;
unsigned long lastReconnect = 0;
bool systemReady = false;
int currentDispenseLogId = 0;

// Function prototypes
void setupWiFi();
void setupMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void reconnectMQTT();
void publishHeartbeat();
void handleDispenseCommand(JsonDocument& doc);
void handlePumpControl(String pumpNumber, JsonDocument& doc);
void runPump(int pumpNumber, float volumeMl);
void publishPumpStatus(int pumpNumber, String status, float dispensedMl);
void publishDispenseFeedback(int logId, String status, int currentPump, int totalPumps);
void setStatusLED(int r, int g, int b);

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("IntelliVend ESP32 Firmware");
  Serial.printf("Version: %s\n", FIRMWARE_VERSION);
  Serial.printf("Device ID: %s\n", DEVICE_ID);
  Serial.println("=================================\n");

  // Initialize GPIO pins
  pinMode(STATUS_LED_PIN, OUTPUT);
  
  for (int i = 0; i < NUM_PUMPS; i++) {
    pinMode(pumpPins[i], OUTPUT);
    digitalWrite(pumpPins[i], LOW);  // Pumps OFF
  }
  
  Serial.println("[INFO] GPIO pins initialized");

  // Setup WiFi and MQTT
  setupWiFi();
  setupMQTT();
  
  systemReady = true;
  Serial.println("[INFO] System ready!");
  setStatusLED(0, 255, 0);  // Green = Ready
}

void loop() {
  // Maintain MQTT connection
  if (!mqtt.connected()) {
    if (millis() - lastReconnect > RECONNECT_INTERVAL) {
      reconnectMQTT();
      lastReconnect = millis();
    }
  } else {
    mqtt.loop();
  }

  // Send heartbeat
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    publishHeartbeat();
    lastHeartbeat = millis();
  }
}

void setupWiFi() {
  Serial.printf("[INFO] Connecting to WiFi: %s\n", WIFI_SSID);
  setStatusLED(0, 0, 255);  // Blue = Connecting
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[INFO] WiFi connected!");
    Serial.printf("[INFO] IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[INFO] Signal Strength: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[ERROR] WiFi connection failed!");
    setStatusLED(255, 0, 0);  // Red = Error
  }
}

void setupMQTT() {
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(1024);  // Increase buffer for larger messages
  
  Serial.printf("[INFO] MQTT Broker: %s:%d\n", MQTT_BROKER, MQTT_PORT);
}

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi not connected, skipping MQTT");
    return;
  }

  Serial.print("[INFO] Connecting to MQTT... ");
  
  bool connected = false;
  if (strlen(MQTT_USER) > 0 && strlen(MQTT_PASSWORD) > 0) {
    connected = mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD);
  } else {
    connected = mqtt.connect(MQTT_CLIENT_ID);
  }
  
  if (connected) {
    Serial.println("Connected!");
    
    // Subscribe to topics
    mqtt.subscribe("intellivend/dispense/command");
    mqtt.subscribe("intellivend/pump/+/control");
    mqtt.subscribe("intellivend/config/update");
    
    Serial.println("[INFO] Subscribed to MQTT topics");
    
    // Publish online status
    publishHeartbeat();
  } else {
    Serial.printf("Failed! RC=%d\n", mqtt.state());
    setStatusLED(255, 0, 0);  // Red = Error
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[MQTT] Message received on %s\n", topic);
  
  // Parse JSON payload
  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.printf("[ERROR] JSON parse failed: %s\n", error.c_str());
    return;
  }

  String topicStr = String(topic);
  
  // Route to appropriate handler
  if (topicStr == "intellivend/dispense/command") {
    handleDispenseCommand(doc);
  } else if (topicStr.startsWith("intellivend/pump/")) {
    // Extract pump number from topic
    int startPos = topicStr.indexOf("/pump/") + 6;
    int endPos = topicStr.indexOf("/", startPos);
    String pumpNumber = topicStr.substring(startPos, endPos);
    handlePumpControl(pumpNumber, doc);
  } else if (topicStr == "intellivend/config/update") {
    // TODO: Handle configuration updates
    Serial.println("[INFO] Config update received (not implemented yet)");
  }
}

void handleDispenseCommand(JsonDocument& doc) {
  int logId = doc["log_id"];
  JsonArray commands = doc["commands"];
  
  Serial.printf("[DISPENSE] Starting log_id: %d with %d pumps\n", logId, commands.size());
  currentDispenseLogId = logId;
  
  // Send started feedback
  publishDispenseFeedback(logId, "started", 0, commands.size());
  
  // Execute each pump command
  for (int i = 0; i < commands.size(); i++) {
    JsonObject cmd = commands[i];
    int pumpNum = cmd["pump_number"];
    float quantityMl = cmd["quantity_ml"];
    String ingredient = cmd["ingredient"] | "Unknown";
    
    Serial.printf("[DISPENSE] Pump %d: %.1f ml of %s\n", pumpNum, quantityMl, ingredient.c_str());
    
    // Run pump
    runPump(pumpNum, quantityMl);
    
    // Send progress feedback
    int progress = ((i + 1) * 100) / commands.size();
    publishDispenseFeedback(logId, "in_progress", i + 1, commands.size());
  }
  
  // Send completed feedback
  publishDispenseFeedback(logId, "completed", commands.size(), commands.size());
  Serial.printf("[DISPENSE] Completed log_id: %d\n", logId);
  
  currentDispenseLogId = 0;
  setStatusLED(0, 255, 0);  // Green = Ready
}

void handlePumpControl(String pumpNumber, JsonDocument& doc) {
  int pumpNum = pumpNumber.toInt();
  String action = doc["action"] | "test";
  int duration = doc["duration"] | 3000;
  
  Serial.printf("[PUMP] Manual control - Pump %d, Action: %s, Duration: %d ms\n", 
                pumpNum, action.c_str(), duration);
  
  if (action == "start" || action == "test") {
    // Convert duration (ms) to approximate volume (assuming ~10ml/s)
    float volumeMl = (duration / 1000.0) * 10.0;
    runPump(pumpNum, volumeMl);
  } else if (action == "stop") {
    digitalWrite(pumpPins[pumpNum - 1], LOW);
    publishPumpStatus(pumpNum, "stopped", 0);
  }
}

void runPump(int pumpNumber, float volumeMl) {
  if (pumpNumber < 1 || pumpNumber > NUM_PUMPS) {
    Serial.printf("[ERROR] Invalid pump number: %d\n", pumpNumber);
    return;
  }
  
  int pumpIndex = pumpNumber - 1;
  int pumpPin = pumpPins[pumpIndex];
  
  // Apply calibration
  float adjustedVolume = volumeMl * pumpCalibration[pumpIndex];
  
  // Calculate run time (assuming 10ml/second flow rate)
  // TODO: Use flow meter for accurate measurement
  unsigned long runTime = (unsigned long)(adjustedVolume / 10.0 * 1000.0);
  
  Serial.printf("[PUMP %d] Running for %lu ms (%.1f ml)\n", pumpNumber, runTime, adjustedVolume);
  
  // Turn pump ON
  digitalWrite(pumpPin, HIGH);
  publishPumpStatus(pumpNumber, "running", 0);
  setStatusLED(0, 255, 0);  // Green blinking during pump operation
  
  // Wait for run time
  delay(runTime);
  
  // Turn pump OFF
  digitalWrite(pumpPin, LOW);
  publishPumpStatus(pumpNumber, "completed", adjustedVolume);
  
  Serial.printf("[PUMP %d] Completed - dispensed %.1f ml\n", pumpNumber, adjustedVolume);
}

void publishPumpStatus(int pumpNumber, String status, float dispensedMl) {
  StaticJsonDocument<256> doc;
  doc["pump_number"] = pumpNumber;
  doc["status"] = status;
  doc["dispensed_ml"] = dispensedMl;
  doc["timestamp"] = millis();
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  String topic = "intellivend/esp32/pump/" + String(pumpNumber) + "/status";
  mqtt.publish(topic.c_str(), buffer);
}

void publishDispenseFeedback(int logId, String status, int currentPump, int totalPumps) {
  StaticJsonDocument<256> doc;
  doc["log_id"] = logId;
  doc["status"] = status;
  doc["current_pump"] = currentPump;
  doc["total_pumps"] = totalPumps;
  doc["progress_percent"] = (currentPump * 100) / totalPumps;
  doc["timestamp"] = millis();
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  mqtt.publish("intellivend/dispense/feedback", buffer);
}

void publishHeartbeat() {
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["status"] = mqtt.connected() ? "online" : "offline";
  doc["ip_address"] = WiFi.localIP().toString();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["uptime_seconds"] = millis() / 1000;
  doc["free_memory"] = ESP.getFreeHeap();
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["timestamp"] = millis();
  
  char buffer[512];
  serializeJson(doc, buffer);
  
  mqtt.publish("intellivend/esp32/status", buffer, true);  // Retained message
  
  if (DEBUG_MODE) {
    Serial.println("[HEARTBEAT] Published system status");
  }
}

void setStatusLED(int r, int g, int b) {
  // TODO: Implement RGB LED control if using RGB LED
  // For now, simple on/off with single color LED
  if (r > 0 || g > 0 || b > 0) {
    digitalWrite(STATUS_LED_PIN, HIGH);
  } else {
    digitalWrite(STATUS_LED_PIN, LOW);
  }
}
