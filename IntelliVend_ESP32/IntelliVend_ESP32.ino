/*
 * IntelliVend ESP32 Firmware for Arduino IDE
 * 
 * Hardware:
 * - ESP32-S3-DEV-N16R8
 * - 8x Micro Peristaltic Pump (DC 6V-12V, 500 motor)
 * - 8x YF-S201 Hall Effect Water Flow Sensor
 * - 8-Channel Relay Board
 * 
 * Author: IntelliVend Team
 * Version: 2.0.0
 * Date: 2025-11-06
 * 
 * Installation for Arduino IDE:
 * 1. Copy config.h.sample to config.h and configure your settings
 * 2. Install libraries: WiFi, PubSubClient, ArduinoJson
 * 3. Select Board: "ESP32S3 Dev Module"
 * 4. Upload
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

// WiFi and MQTT clients
WiFiClient espClient;
PubSubClient mqtt(espClient);

// ============================================
// Hardware Configuration
// ============================================

// Number of pumps
const int NUM_PUMPS = 8;

// Pump relay pins (pump_number -> GPIO pin mapping)
const int pumpPins[NUM_PUMPS] = {
  PUMP_1_PIN, PUMP_2_PIN, PUMP_3_PIN, PUMP_4_PIN,
  PUMP_5_PIN, PUMP_6_PIN, PUMP_7_PIN, PUMP_8_PIN
};

// Flow meter pins (pump_number -> flow sensor GPIO pin mapping)
const int flowMeterPins[NUM_PUMPS] = {
  FLOW_METER_1_PIN, FLOW_METER_2_PIN, FLOW_METER_3_PIN, FLOW_METER_4_PIN,
  FLOW_METER_5_PIN, FLOW_METER_6_PIN, FLOW_METER_7_PIN, FLOW_METER_8_PIN
};

// Pump calibration factors (fine-tune after testing)
float pumpCalibration[NUM_PUMPS] = {
  PUMP_1_CALIBRATION, PUMP_2_CALIBRATION, PUMP_3_CALIBRATION, PUMP_4_CALIBRATION,
  PUMP_5_CALIBRATION, PUMP_6_CALIBRATION, PUMP_7_CALIBRATION, PUMP_8_CALIBRATION
};

// ============================================
// Flow Meter Variables
// ============================================

volatile unsigned long flowPulseCount[NUM_PUMPS] = {0, 0, 0, 0, 0, 0, 0, 0};
volatile unsigned long lastFlowPulse[NUM_PUMPS] = {0, 0, 0, 0, 0, 0, 0, 0};
float totalDispensedML[NUM_PUMPS] = {0, 0, 0, 0, 0, 0, 0, 0};

// Interrupt handlers for each flow meter
void IRAM_ATTR flowMeter1ISR() { flowPulseCount[0] = flowPulseCount[0] + 1; lastFlowPulse[0] = millis(); }
void IRAM_ATTR flowMeter2ISR() { flowPulseCount[1] = flowPulseCount[1] + 1; lastFlowPulse[1] = millis(); }
void IRAM_ATTR flowMeter3ISR() { flowPulseCount[2] = flowPulseCount[2] + 1; lastFlowPulse[2] = millis(); }
void IRAM_ATTR flowMeter4ISR() { flowPulseCount[3] = flowPulseCount[3] + 1; lastFlowPulse[3] = millis(); }
void IRAM_ATTR flowMeter5ISR() { flowPulseCount[4] = flowPulseCount[4] + 1; lastFlowPulse[4] = millis(); }
void IRAM_ATTR flowMeter6ISR() { flowPulseCount[5] = flowPulseCount[5] + 1; lastFlowPulse[5] = millis(); }
void IRAM_ATTR flowMeter7ISR() { flowPulseCount[6] = flowPulseCount[6] + 1; lastFlowPulse[6] = millis(); }
void IRAM_ATTR flowMeter8ISR() { flowPulseCount[7] = flowPulseCount[7] + 1; lastFlowPulse[7] = millis(); }

// Array of ISR function pointers
void (*flowMeterISRs[NUM_PUMPS])() = {
  flowMeter1ISR, flowMeter2ISR, flowMeter3ISR, flowMeter4ISR,
  flowMeter5ISR, flowMeter6ISR, flowMeter7ISR, flowMeter8ISR
};

// ============================================
// System State
// ============================================

unsigned long lastHeartbeat = 0;
unsigned long lastReconnect = 0;
bool systemReady = false;
String currentRecipeName = "";

// ============================================
// Function Prototypes
// ============================================

void setupWiFi();
void setupMQTT();
void setupFlowMeters();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void reconnectMQTT();
void publishHeartbeat();
void handleDispenseCommand(JsonDocument& doc);
void handleFlushCommand(JsonDocument& doc);
void handleCalibrationCommand(JsonDocument& doc);
void handleEmergencyStop(JsonDocument& doc);
void runPump(int pumpNumber, float volumeML, String ingredient = "", bool publishCompletion = true);
void flushPump(int pumpNumber, int durationMS);
float getFlowML(int pumpIndex);
void resetFlowMeter(int pumpIndex);
void publishStatus(String topic, JsonDocument& doc);
void publishDispenseStatus(int pumpNumber, String state, float progressML, float targetML, unsigned long elapsedMS);
void publishDispenseComplete(int pumpNumber, String recipeName, float actualML, float requestedML, unsigned long durationMS);
void publishMaintenanceComplete(int pumpNumber, String actionType, unsigned long durationMS);
void publishError(int pumpNumber, String errorCode, String message, String severity = "error");
void setStatusLED(int r, int g, int b);

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("IntelliVend ESP32-S3 Firmware");
  Serial.printf("Version: %s\n", FIRMWARE_VERSION);
  Serial.printf("Device ID: %s\n", DEVICE_ID);
  Serial.println("Hardware: ESP32-S3-DEV-N16R8");
  Serial.println("Pumps: 8x Peristaltic + Relay");
  
  #ifdef SIMULATE_FLOW_METERS
  if (SIMULATE_FLOW_METERS) {
    Serial.println("Sensors: 🔵 SIMULATED (Flow meters not connected)");
    Serial.printf("Sim Flow Rate: %.1f ml/sec\n", SIMULATED_FLOW_RATE);
  } else {
    Serial.println("Sensors: 8x YF-S201 Flow Meter");
  }
  #else
  Serial.println("Sensors: 8x YF-S201 Flow Meter");
  #endif
  
  Serial.println("=================================\n");

  // Initialize status LED
  // pinMode(STATUS_LED_PIN, OUTPUT);
  // setStatusLED(255, 255, 0);  // Yellow = Initializing
  
  // Initialize pump relay pins (Active LOW - relay triggers on LOW signal)
  Serial.println("[INIT] Configuring pump relay pins...");
  for (int i = 0; i < NUM_PUMPS; i++) {
    pinMode(pumpPins[i], OUTPUT);
    digitalWrite(pumpPins[i], HIGH);  // Relay OFF (Active LOW: HIGH = OFF)
    Serial.printf("  Pump %d -> GPIO %d (Active LOW)\n", i + 1, pumpPins[i]);
  }
  
  // Initialize flow meters
  setupFlowMeters();

  // Setup WiFi and MQTT
  setupWiFi();
  setupMQTT();
  
  systemReady = true;
  Serial.println("\n[INFO] System ready!");
  setStatusLED(0, 255, 0);  // Green = Ready
}

// ============================================
// MAIN LOOP
// ============================================

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
  
  // Small delay to prevent watchdog reset
  delay(10);
  yield();
}

// ============================================
// WIFI SETUP
// ============================================

void setupWiFi() {
  Serial.printf("[WiFi] Connecting to: %s\n", WIFI_SSID);
  setStatusLED(0, 0, 255);  // Blue = Connecting
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
    yield();  // Feed watchdog
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi] Signal: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[ERROR] WiFi connection failed!");
    Serial.println("[WARN] Running in offline mode");
    setStatusLED(255, 128, 0);  // Orange = Offline
  }
}

// ============================================
// MQTT SETUP
// ============================================

void setupMQTT() {
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(2048);  // Increase buffer for larger JSON messages
  
  Serial.printf("[MQTT] Broker: %s:%d\n", MQTT_BROKER, MQTT_PORT);
}

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[MQTT] WiFi not connected, skipping MQTT reconnect");
    return;
  }

  Serial.print("[MQTT] Connecting... ");
  
  bool connected = false;
  if (strlen(MQTT_USER) > 0 && strlen(MQTT_PASSWORD) > 0) {
    connected = mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD);
  } else {
    connected = mqtt.connect(MQTT_CLIENT_ID);
  }
  
  if (connected) {
    Serial.println("Connected!");
    
    // Subscribe to command topics
    mqtt.subscribe("intellivend/dispense/command");
    mqtt.subscribe("intellivend/maintenance/flush");
    mqtt.subscribe("intellivend/calibration/start");
    mqtt.subscribe("intellivend/emergency/stop");
    
    Serial.println("[MQTT] Subscribed to topics:");
    Serial.println("  - intellivend/dispense/command");
    Serial.println("  - intellivend/maintenance/flush");
    Serial.println("  - intellivend/calibration/start");
    Serial.println("  - intellivend/emergency/stop");
    
    // Publish online status
    publishHeartbeat();
    setStatusLED(0, 255, 0);  // Green = Connected
  } else {
    Serial.printf("Failed! RC=%d\n", mqtt.state());
    Serial.println("[WARN] Will retry MQTT connection later");
    setStatusLED(255, 128, 0);  // Orange = Disconnected
  }
  
  yield();  // Feed watchdog
}

// ============================================
// FLOW METER SETUP
// ============================================

void setupFlowMeters() {
  Serial.println("[INIT] Configuring YF-S201 flow meters...");
  
  for (int i = 0; i < NUM_PUMPS; i++) {
    pinMode(flowMeterPins[i], INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(flowMeterPins[i]), flowMeterISRs[i], RISING);
    resetFlowMeter(i);
    Serial.printf("  Flow Meter %d -> GPIO %d\n", i + 1, flowMeterPins[i]);
  }
  
  Serial.printf("[INIT] Flow meter calibration: %.0f pulses/liter\n", PULSES_PER_LITER);
}

// ============================================
// MQTT CALLBACK
// ============================================

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("\n[MQTT] ← %s (%d bytes)\n", topic, length);
  
  // Parse JSON payload
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.printf("[ERROR] JSON parse failed: %s\n", error.c_str());
    publishError(0, "JSON_PARSE_ERROR", String("Failed to parse: ") + error.c_str(), "warning");
    return;
  }

  String topicStr = String(topic);
  
  // Route to appropriate handler
  if (topicStr == "intellivend/dispense/command") {
    handleDispenseCommand(doc);
  } else if (topicStr == "intellivend/maintenance/flush") {
    handleFlushCommand(doc);
  } else if (topicStr == "intellivend/calibration/start") {
    handleCalibrationCommand(doc);
  } else if (topicStr == "intellivend/emergency/stop") {
    handleEmergencyStop(doc);
  }
}

// ============================================
// DISPENSE COMMAND HANDLER
// ============================================

void handleDispenseCommand(JsonDocument& doc) {
  int pumpId = doc["pump_id"] | 0;
  JsonArray amountArray = doc["amount_ml"];
  String recipeName = doc["recipe_name"] | "";
  
  currentRecipeName = recipeName;
  
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.printf("║ DISPENSE: %s\n", recipeName.c_str());
  Serial.printf("║ Ingredients: %d\n", amountArray.size());
  Serial.println("╚════════════════════════════════════════╝");
  
  setStatusLED(255, 255, 0);  // Yellow = Dispensing
  
  int totalPumps = amountArray.size();
  int currentPumpIndex = 0;
  float totalActualML = 0.0;
  float totalRequestedML = 0.0;
  unsigned long totalStartTime = millis();
  
  // Process each ingredient
  for (JsonVariant item : amountArray) {
    currentPumpIndex++;
    
    int pumpNumber = item["pump_number"] | 0;
    float quantityML = item["quantity_ml"] | 0.0;
    String ingredient = item["ingredient"] | "Unknown";
    int order = item["order"] | 0;
    
    // IMPORTANT: We ignore gpio_pin from backend, use our own mapping
    
    if (pumpNumber < 1 || pumpNumber > NUM_PUMPS) {
      Serial.printf("[ERROR] Invalid pump number: %d\n", pumpNumber);
      publishError(pumpNumber, "INVALID_PUMP", "Pump number out of range", "error");
      continue;
    }
    
    Serial.printf("\n[%d/%d] Pump %d: %.1f ml of %s\n", 
                  currentPumpIndex, totalPumps, pumpNumber, quantityML, ingredient.c_str());
    
    // Run pump with flow meter monitoring (no individual completion message)
    runPump(pumpNumber, quantityML, ingredient, false);  // false = don't publish completion
    
    // Track totals for final completion message
    int pumpIndex = pumpNumber - 1;
    totalActualML += totalDispensedML[pumpIndex];
    totalRequestedML += quantityML;
    
    delay(500);  // Small delay between pumps
  }
  
  // Publish single completion message for entire recipe
  unsigned long totalDuration = millis() - totalStartTime;
  publishDispenseComplete(0, recipeName, totalActualML, totalRequestedML, totalDuration);
  
  Serial.println("\n✓ Dispense complete!\n");
  currentRecipeName = "";
  setStatusLED(0, 255, 0);  // Green = Ready
}

// ============================================
// FLUSH COMMAND HANDLER
// ============================================

void handleFlushCommand(JsonDocument& doc) {
  int pumpId = doc["pump_id"] | 0;
  int durationMS = doc["duration_ms"] | 5000;
  
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.printf("║ FLUSH PUMP: %d (%d ms)\n", pumpId, durationMS);
  Serial.println("╚════════════════════════════════════════╝");
  
  setStatusLED(0, 255, 255);  // Cyan = Maintenance
  
  if (pumpId == -1) {
    // Flush all pumps
    Serial.println("[FLUSH] All pumps");
    for (int i = 1; i <= NUM_PUMPS; i++) {
      Serial.printf("\nFlushing pump %d...\n", i);
      flushPump(i, durationMS);
      delay(1000);  // Delay between pumps
    }
  } else if (pumpId >= 1 && pumpId <= NUM_PUMPS) {
    // Flush single pump
    Serial.printf("[FLUSH] Pump %d\n", pumpId);
    flushPump(pumpId, durationMS);
  } else {
    Serial.printf("[ERROR] Invalid pump ID: %d\n", pumpId);
    publishError(pumpId, "INVALID_PUMP", "Pump number out of range", "error");
  }
  
  Serial.println("\n✓ Flush complete!\n");
  setStatusLED(0, 255, 0);  // Green = Ready
}

// ============================================
// CALIBRATION COMMAND HANDLER
// ============================================

void handleCalibrationCommand(JsonDocument& doc) {
  int pumpId = doc["pump_id"] | 0;
  float testAmountML = doc["test_amount_ml"] | 100.0;
  int timeoutMS = doc["timeout_ms"] | 30000;
  
  if (pumpId < 1 || pumpId > NUM_PUMPS) {
    Serial.printf("[ERROR] Invalid pump ID for calibration: %d\n", pumpId);
    publishError(pumpId, "INVALID_PUMP", "Pump number out of range", "error");
    return;
  }
  
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.printf("║ CALIBRATION: Pump %d\n", pumpId);
  Serial.printf("║ Target: %.1f ml\n", testAmountML);
  Serial.println("╚════════════════════════════════════════╝");
  
  setStatusLED(255, 0, 255);  // Magenta = Calibration
  
  Serial.println("[CALIB] Place measuring container under pump");
  Serial.println("[CALIB] Dispensing test amount...");
  
  unsigned long startTime = millis();
  runPump(pumpId, testAmountML, "Calibration Test");
  unsigned long duration = millis() - startTime;
  
  float actualML = totalDispensedML[pumpId - 1];
  float calibrationFactor = testAmountML / actualML;
  
  Serial.printf("\n[CALIB] Results:\n");
  Serial.printf("  Requested: %.1f ml\n", testAmountML);
  Serial.printf("  Measured:  %.1f ml\n", actualML);
  Serial.printf("  Duration:  %lu ms\n", duration);
  Serial.printf("  Suggested calibration factor: %.4f\n", calibrationFactor);
  Serial.println("\n[CALIB] Update config.h with new PUMP_X_CALIBRATION value");
  
  publishMaintenanceComplete(pumpId, "calibration", duration);
  
  Serial.println("\n✓ Calibration complete!\n");
  setStatusLED(0, 255, 0);  // Green = Ready
}

// ============================================
// EMERGENCY STOP HANDLER
// ============================================

void handleEmergencyStop(JsonDocument& doc) {
  String reason = doc["reason"] | "Emergency stop";
  
  Serial.println("\n╔════════════════════════════════════════╗");
  Serial.printf("║ ⚠ EMERGENCY STOP: %s\n", reason.c_str());
  Serial.println("╚════════════════════════════════════════╝");
  
  // Turn off all pumps immediately (Active LOW: HIGH = OFF)
  for (int i = 0; i < NUM_PUMPS; i++) {
    digitalWrite(pumpPins[i], HIGH);
  }
  
  setStatusLED(255, 0, 0);  // Red = Emergency
  
  publishError(0, "EMERGENCY_STOP", reason, "critical");
  
  delay(3000);
  setStatusLED(0, 255, 0);  // Green = Ready
}

// ============================================
// RUN PUMP WITH FLOW METER
// ============================================

void runPump(int pumpNumber, float volumeML, String ingredient, bool publishCompletion) {
  if (pumpNumber < 1 || pumpNumber > NUM_PUMPS) {
    return;
  }
  
  int pumpIndex = pumpNumber - 1;
  int relayPin = pumpPins[pumpIndex];
  
  // Apply calibration factor
  float targetML = volumeML * pumpCalibration[pumpIndex];
  float targetPulses = (targetML / 1000.0) * PULSES_PER_LITER;
  
  #ifdef SIMULATE_FLOW_METERS
  if (SIMULATE_FLOW_METERS) {
    Serial.printf("[PUMP %d] 🔵 SIMULATION MODE - Target: %.1f ml\n", pumpNumber, targetML);
  } else {
    Serial.printf("[PUMP %d] Target: %.1f ml (%.0f pulses)\n", pumpNumber, targetML, targetPulses);
  }
  #else
  Serial.printf("[PUMP %d] Target: %.1f ml (%.0f pulses)\n", pumpNumber, targetML, targetPulses);
  #endif
  
  // Reset flow meter
  resetFlowMeter(pumpIndex);
  
  // Turn pump ON (Active LOW: relay triggers on LOW)
  digitalWrite(relayPin, LOW);
  unsigned long startTime = millis();
  unsigned long lastReport = startTime;
  
  #ifdef SIMULATE_FLOW_METERS
  if (SIMULATE_FLOW_METERS) {
    // SIMULATION MODE: Simulate realistic flow
    unsigned long lastUpdate = startTime;
    float simulatedML = 0.0;
    
    while (simulatedML < targetML) {
      unsigned long now = millis();
      
      // Simulate flow accumulation
      if (now - lastUpdate >= SIMULATION_UPDATE_MS) {
        float deltaTime = (now - lastUpdate) / 1000.0;  // seconds
        float deltaML = SIMULATED_FLOW_RATE * deltaTime;
        simulatedML += deltaML;
        
        // Simulate pulse count for getFlowML()
        flowPulseCount[pumpIndex] = (simulatedML / 1000.0) * PULSES_PER_LITER;
        
        lastUpdate = now;
      }
      
      // Timeout protection (60 seconds max)
      if (now - startTime > PUMP_TIMEOUT) {
        Serial.printf("[WARN] Pump %d timeout after %lu ms\n", pumpNumber, now - startTime);
        publishError(pumpNumber, "PUMP_TIMEOUT", "Flow timeout - check pump/sensor", "warning");
        break;
      }
      
      // Progress report every 500ms (for smooth progress bar with small volumes)
      if (now - lastReport > 500) {
        Serial.printf("[PUMP %d] 🔵 SIMULATED Progress: %.1f/%.1f ml (%.0f%%)\n", 
                      pumpNumber, simulatedML, targetML, (simulatedML / targetML) * 100.0);
        
        // Publish status to MQTT for frontend progress bar
        publishDispenseStatus(pumpNumber, "dispensing", simulatedML, targetML, now - startTime);
        
        lastReport = now;
      }
      
      delay(10);
    }
  } else {
  #endif
    // REAL FLOW METER MODE
    while (flowPulseCount[pumpIndex] < targetPulses) {
      unsigned long now = millis();
      
      // Timeout protection (60 seconds max)
      if (now - startTime > PUMP_TIMEOUT) {
        Serial.printf("[WARN] Pump %d timeout after %lu ms\n", pumpNumber, now - startTime);
        publishError(pumpNumber, "PUMP_TIMEOUT", "Flow timeout - check pump/sensor", "warning");
        break;
      }
      
      // Progress report every 500ms (for smooth progress bar with small volumes)
      if (now - lastReport > 500) {
        float currentML = getFlowML(pumpIndex);
        Serial.printf("[PUMP %d] Progress: %.1f/%.1f ml (%.0f%%)\n", 
                      pumpNumber, currentML, targetML, (currentML / targetML) * 100.0);
        
        // Publish status to MQTT for frontend progress bar
        publishDispenseStatus(pumpNumber, "dispensing", currentML, targetML, now - startTime);
        
        lastReport = now;
      }
      
      delay(10);  // Small delay to prevent busy-waiting
    }
  #ifdef SIMULATE_FLOW_METERS
  }
  #endif
  
  // Turn pump OFF (Active LOW: HIGH = OFF)
  digitalWrite(relayPin, HIGH);
  unsigned long duration = millis() - startTime;
  
  // Calculate actual dispensed volume
  float actualML = getFlowML(pumpIndex);
  totalDispensedML[pumpIndex] = actualML;
  
  #ifdef SIMULATE_FLOW_METERS
  if (SIMULATE_FLOW_METERS) {
    Serial.printf("[PUMP %d] 🔵 SIMULATED Complete: %.1f ml in %lu ms\n", pumpNumber, actualML, duration);
  } else {
    Serial.printf("[PUMP %d] Complete: %.1f ml in %lu ms\n", pumpNumber, actualML, duration);
  }
  #else
  Serial.printf("[PUMP %d] Complete: %.1f ml in %lu ms\n", pumpNumber, actualML, duration);
  #endif
  
  // Publish completion to backend (only if requested)
  if (publishCompletion) {
    publishDispenseComplete(pumpNumber, currentRecipeName, actualML, volumeML, duration);
  }
}

// ============================================
// FLUSH PUMP (TIME-BASED)
// ============================================

void flushPump(int pumpNumber, int durationMS) {
  if (pumpNumber < 1 || pumpNumber > NUM_PUMPS) {
    return;
  }
  
  int pumpIndex = pumpNumber - 1;
  int relayPin = pumpPins[pumpIndex];
  
  Serial.printf("[FLUSH %d] Running for %d ms\n", pumpNumber, durationMS);
  
  resetFlowMeter(pumpIndex);
  
  // Turn pump ON (Active LOW: LOW = ON)
  digitalWrite(relayPin, LOW);
  unsigned long startTime = millis();
  
  // Run for specified duration
  delay(durationMS);
  
  // Turn pump OFF (Active LOW: HIGH = OFF)
  digitalWrite(relayPin, HIGH);
  unsigned long duration = millis() - startTime;
  
  float actualML = getFlowML(pumpIndex);
  Serial.printf("[FLUSH %d] Dispensed %.1f ml in %lu ms\n", pumpNumber, actualML, duration);
  
  publishMaintenanceComplete(pumpNumber, "flush", duration);
}

// ============================================
// FLOW METER FUNCTIONS
// ============================================

float getFlowML(int pumpIndex) {
  if (pumpIndex < 0 || pumpIndex >= NUM_PUMPS) {
    return 0.0;
  }
  
  // Convert pulses to milliliters
  // pulses / (pulses_per_liter) * 1000 = ml
  float ml = (flowPulseCount[pumpIndex] / PULSES_PER_LITER) * 1000.0;
  return ml;
}

void resetFlowMeter(int pumpIndex) {
  if (pumpIndex < 0 || pumpIndex >= NUM_PUMPS) {
    return;
  }
  
  noInterrupts();
  flowPulseCount[pumpIndex] = 0;
  lastFlowPulse[pumpIndex] = 0;
  totalDispensedML[pumpIndex] = 0.0;
  interrupts();
}

// ============================================
// MQTT PUBLISHING FUNCTIONS
// ============================================

void publishHeartbeat() {
  JsonDocument doc;
  
  doc["uptime_ms"] = millis();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["total_heap"] = ESP.getHeapSize();
  doc["pumps_active"] = 0;  // TODO: Track active pumps
  doc["firmware_version"] = FIRMWARE_VERSION;
  
  char buffer[512];
  serializeJson(doc, buffer);
  
  mqtt.publish("intellivend/heartbeat", buffer, true);  // Retained
  
  if (DEBUG_MODE) {
    Serial.println("[HEARTBEAT] Published");
  }
}

void publishDispenseStatus(int pumpNumber, String state, float progressML, float targetML, unsigned long elapsedMS) {
  JsonDocument doc;
  
  doc["pump_id"] = pumpNumber;
  doc["state"] = state;
  doc["progress_ml"] = progressML;
  doc["target_ml"] = targetML;
  doc["elapsed_ms"] = elapsedMS;
  
  // Calculate flow rate (ml/s)
  if (elapsedMS > 0) {
    float flowRate = (progressML / elapsedMS) * 1000.0;
    doc["flow_rate_ml_s"] = flowRate;
  } else {
    doc["flow_rate_ml_s"] = 0.0;
  }
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  mqtt.publish("intellivend/status", buffer);
  
  if (DEBUG_MODE) {
    Serial.printf("[MQTT] → intellivend/status (Pump %d: %.1f/%.1f ml)\n", 
                  pumpNumber, progressML, targetML);
  }
}

void publishDispenseComplete(int pumpNumber, String recipeName, float actualML, float requestedML, unsigned long durationMS) {
  JsonDocument doc;
  
  doc["pump_id"] = pumpNumber;
  doc["recipe_name"] = recipeName;
  doc["requested_ml"] = requestedML;
  doc["actual_ml"] = actualML;
  doc["duration_ms"] = durationMS;
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  mqtt.publish("intellivend/dispense/complete", buffer);
  
  Serial.printf("[MQTT] → intellivend/dispense/complete (Pump %d, %s)\n", pumpNumber, recipeName.c_str());
}

void publishMaintenanceComplete(int pumpNumber, String actionType, unsigned long durationMS) {
  JsonDocument doc;
  
  doc["pump_id"] = pumpNumber;
  doc["action_type"] = actionType;
  doc["duration_ms"] = durationMS;
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  mqtt.publish("intellivend/maintenance/complete", buffer);
  
  Serial.printf("[MQTT] → intellivend/maintenance/complete (%s, Pump %d)\n", 
                actionType.c_str(), pumpNumber);
}

void publishError(int pumpNumber, String errorCode, String message, String severity) {
  JsonDocument doc;
  
  doc["pump_id"] = pumpNumber;
  doc["error_code"] = errorCode;
  doc["severity"] = severity;
  doc["message"] = message;
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  mqtt.publish("intellivend/error", buffer);
  
  Serial.printf("[MQTT] → intellivend/error [%s] %s\n", errorCode.c_str(), message.c_str());
}

void publishStatus(String topic, JsonDocument& doc) {
  char buffer[512];
  serializeJson(doc, buffer);
  mqtt.publish(topic.c_str(), buffer);
}

// ============================================
// STATUS LED CONTROL
// ============================================

void setStatusLED(int r, int g, int b) {
  // Simple on/off for single-color LED
  // Expand this for RGB LED with PWM if needed
  if (r > 0 || g > 0 || b > 0) {
    digitalWrite(STATUS_LED_PIN, HIGH);
  } else {
    digitalWrite(STATUS_LED_PIN, LOW);
  }
}
