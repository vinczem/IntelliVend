#!/usr/bin/env python3
"""
IntelliVend ESP32 Mock Client
==============================

Ez a szkript szimulálja az ESP32 viselkedését MQTT üzenetek segítségével.
Használható a backend és frontend teszteléséhez, mielőtt a tényleges ESP32 firmware elkészülne.

Funkciók:
- Dispense command fogadása és szimuláció
- Maintenance flush fogadása és szimuláció
- Calibration command fogadása
- Emergency stop kezelés
- Heartbeat küldés (10 másodpercenként)
- Real-time status updates (500ms-enként)

Használat:
    python3 esp32_mock.py
    python3 esp32_mock.py --broker 192.168.0.55 --port 1883
    python3 esp32_mock.py --error-rate 0.1  # 10% esély hibára

Követelmények:
    pip install paho-mqtt
"""

import paho.mqtt.client as mqtt
import json
import time
import threading
import random
import argparse
from datetime import datetime
from typing import Dict, Optional

class ESP32Mock:
    """ESP32 MQTT kliens szimulátor"""
    
    def __init__(self, broker: str = "homeassistant.local", port: int = 1883, username: str = None, password: str = None, error_rate: float = 0.0):
        """
        Args:
            broker: MQTT broker IP címe
            port: MQTT broker port
            username: MQTT username (opcionális)
            password: MQTT password (opcionális)
            error_rate: Hibák generálásának valószínűsége (0.0 - 1.0)
        """
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        self.error_rate = error_rate
        
        # MQTT client (use callback API v2)
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="ESP32_MOCK", clean_session=True)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        # Set username/password if provided
        if self.username and self.password:
            self.client.username_pw_set(self.username, self.password)
        
        # State
        self.connected = False
        self.uptime_start = time.time()
        self.active_dispense: Optional[Dict] = None
        self.active_flush: Optional[Dict] = None
        self.active_calibration: Optional[Dict] = None
        self.pumps_active = 0
        
        # Threads
        self.heartbeat_thread = None
        self.stop_event = threading.Event()
        
    def on_connect(self, client, userdata, flags, reason_code, properties):
        """MQTT kapcsolódás esemény (Callback API v2)"""
        if reason_code == 0 or (hasattr(reason_code, 'value') and reason_code.value == 0):
            self.connected = True
            print(f"[ESP32] Connected to MQTT broker {self.broker}:{self.port}")
            
            # Subscribe to command topics
            topics = [
                ("intellivend/dispense/command", 1),
                ("intellivend/maintenance/flush", 1),
                ("intellivend/calibration/start", 1),
                ("intellivend/emergency/stop", 2),
            ]
            
            for topic, qos in topics:
                client.subscribe(topic, qos)
                print(f"[ESP32] Subscribed to: {topic} (QoS {qos})")
            
            # Start heartbeat thread (only once)
            if self.heartbeat_thread is None or not self.heartbeat_thread.is_alive():
                self.heartbeat_thread = threading.Thread(target=self.heartbeat_loop, daemon=True)
                self.heartbeat_thread.start()
                print(f"[ESP32] Heartbeat thread started")
            
        else:
            rc_val = reason_code.value if hasattr(reason_code, 'value') else reason_code
            print(f"[ESP32] Connection failed with code {rc_val}")
    
    def on_disconnect(self, client, userdata, flags, reason_code, properties):
        """MQTT kapcsolat megszakadás (Callback API v2)"""
        self.connected = False
        rc_val = reason_code.value if hasattr(reason_code, 'value') else reason_code
        if rc_val != 0:
            print(f"[ESP32] Unexpected disconnect (code {rc_val}), reconnecting...")
    
    def on_message(self, client, userdata, msg):
        """MQTT üzenet fogadása"""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())
            
            print(f"\n[ESP32] Received on {topic}:")
            print(f"   {json.dumps(payload, indent=3)}")
            
            # Route to appropriate handler
            if topic == "intellivend/dispense/command":
                self.handle_dispense_command(payload)
            elif topic == "intellivend/maintenance/flush":
                self.handle_flush_command(payload)
            elif topic == "intellivend/calibration/start":
                self.handle_calibration_command(payload)
            elif topic == "intellivend/emergency/stop":
                self.handle_emergency_stop(payload)
                
        except json.JSONDecodeError as e:
            print(f"[ESP32] Invalid JSON: {e}")
        except Exception as e:
            print(f"[ESP32] Error handling message: {e}")
    
    def handle_dispense_command(self, payload: Dict):
        """Dispense parancs kezelése - támogatja mind az egyszerű, mind a komplex formátumot"""
        pump_id = payload.get("pump_id")
        amount_ml = payload.get("amount_ml")
        duration_ms = payload.get("duration_ms")  # Optional, calculated if not provided
        recipe_name = payload.get("recipe_name", "Unknown")
        
        # Validate required fields
        if pump_id is None or amount_ml is None:
            self.publish_error(pump_id or 0, "INVALID_COMMAND", "Missing required fields: pump_id and amount_ml", "critical")
            return
        
        # Handle complex multi-pump dispense (amount_ml is array)
        if isinstance(amount_ml, list):
            print(f"[ESP32] Multi-pump recipe: {recipe_name or 'Unknown'}")
            
            # Simulate random error
            if random.random() < self.error_rate:
                error_codes = ["PUMP_STUCK", "FLOW_SENSOR_ERROR", "TIMEOUT"]
                error_code = random.choice(error_codes)
                self.publish_error(amount_ml[0].get("pump_number", 1), error_code, f"Simulated error: {error_code}", "critical")
                return
            
            print(f"[ESP32] Starting multi-pump dispense: {len(amount_ml)} ingredients")
            
            # Run dispense in separate thread for ALL pumps
            thread = threading.Thread(
                target=self.simulate_multi_pump_dispense,
                args=(amount_ml, recipe_name or "Multi-ingredient"),
                daemon=True
            )
            thread.start()
            
        # Handle simple single-pump dispense (amount_ml is number)
        else:
            # Calculate duration if not provided (assume 20ml/s flow rate)
            if duration_ms is None:
                flow_rate_ml_s = 20.0
                duration_ms = int((amount_ml / flow_rate_ml_s) * 1000)
            
            # Simulate random error
            if random.random() < self.error_rate:
                error_codes = ["PUMP_STUCK", "FLOW_SENSOR_ERROR", "TIMEOUT"]
                error_code = random.choice(error_codes)
                self.publish_error(pump_id, error_code, f"Simulated error: {error_code}", "critical")
                return
            
            print(f"[ESP32] Starting dispense: Pump {pump_id}, {amount_ml}ml, {duration_ms}ms")
            
            # Run dispense in separate thread
            thread = threading.Thread(
                target=self.simulate_dispense,
                args=(pump_id, amount_ml, duration_ms, recipe_name),
                daemon=True
            )
            thread.start()
    
    def simulate_multi_pump_dispense(self, ingredients: list, recipe_name: str):
        """Több pumpás adagolás szimulálása (mint az ESP32)"""
        total_start_time = time.time()
        total_actual_ml = 0.0
        total_requested_ml = 0.0
        
        # Calculate total recipe volume for cumulative progress
        total_recipe_ml = sum(item.get("quantity_ml", 0.0) for item in ingredients)
        cumulative_ml = 0.0
        
        print(f"[ESP32] Recipe: {recipe_name}, Total volume: {total_recipe_ml:.1f}ml")
        
        # Process each pump sequentially (like real ESP32)
        for idx, item in enumerate(ingredients):
            pump_number = item.get("pump_number", 1)
            quantity_ml = item.get("quantity_ml", 0.0)
            ingredient_name = item.get("ingredient", "Unknown")
            order = item.get("order", idx + 1)
            
            print(f"[ESP32] [{order}/{len(ingredients)}] Pump {pump_number}: {quantity_ml}ml of {ingredient_name} (cumulative: {cumulative_ml:.1f}/{total_recipe_ml:.1f}ml)")
            
            # Calculate duration for this pump (assume 20ml/s)
            flow_rate_ml_s = 20.0
            duration_ms = int((quantity_ml / flow_rate_ml_s) * 1000)
            if duration_ms < 500:
                duration_ms = 500
            
            # Simulate this pump's dispense
            self.pumps_active += 1
            start_time = time.time()
            duration_sec = duration_ms / 1000.0
            
            steps = int(duration_sec / 0.5)
            if steps < 1:
                steps = 1
            
            for i in range(steps + 1):
                if self.stop_event.is_set():
                    print(f"[ESP32] Dispense stopped (emergency)")
                    self.publish_error(pump_number, "EMERGENCY_STOP", "Emergency stop triggered", "warning")
                    self.pumps_active -= 1
                    return
                
                progress = i / steps
                current_ml = quantity_ml * progress
                elapsed_ms = int((time.time() - start_time) * 1000)
                
                # Calculate cumulative recipe progress
                recipe_progress_ml = cumulative_ml + current_ml
                recipe_elapsed_ms = int((time.time() - total_start_time) * 1000)
                
                # Calculate flow rate (ml/s) based on total elapsed time
                if recipe_elapsed_ms > 0:
                    flow_rate = (recipe_progress_ml / recipe_elapsed_ms) * 1000
                else:
                    flow_rate = 0.0
                
                # Publish status (CUMULATIVE recipe progress, not individual pump)
                status = {
                    "pump_id": pump_number,
                    "state": "dispensing" if progress < 1.0 else "idle",
                    "progress_ml": round(recipe_progress_ml, 2),  # Cumulative!
                    "target_ml": total_recipe_ml,  # Total recipe volume!
                    "flow_rate_ml_s": round(flow_rate, 2),
                    "elapsed_ms": recipe_elapsed_ms,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
                
                self.client.publish("intellivend/status", json.dumps(status), qos=0)
                print(f"[ESP32] Recipe Status: {recipe_progress_ml:.1f}/{total_recipe_ml:.1f}ml ({(recipe_progress_ml/total_recipe_ml)*100:.0f}%)")
                
                if i < steps:
                    time.sleep(0.5)
            
            # Simulate slight variance (+/- 5%)
            actual_ml = quantity_ml * random.uniform(0.95, 1.05)
            actual_ml = round(actual_ml, 2)
            
            total_actual_ml += actual_ml
            total_requested_ml += quantity_ml
            cumulative_ml += actual_ml  # Update cumulative progress for next pump
            
            print(f"[ESP32] Pump {pump_number} complete: {actual_ml}ml (cumulative: {cumulative_ml:.1f}ml)")
            self.pumps_active -= 1
            
            # Small delay between pumps (like real ESP32)
            if idx < len(ingredients) - 1:
                time.sleep(0.5)
        
        # Send single completion message for entire recipe
        total_duration_ms = int((time.time() - total_start_time) * 1000)
        complete = {
            "pump_id": 0,  # 0 = multi-pump recipe
            "recipe_name": recipe_name,
            "requested_ml": round(total_requested_ml, 2),
            "actual_ml": round(total_actual_ml, 2),
            "duration_ms": total_duration_ms,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        self.client.publish("intellivend/dispense/complete", json.dumps(complete), qos=1)
        print(f"[ESP32] ✓ Recipe complete: {total_actual_ml:.1f}ml total in {total_duration_ms}ms")
    
    def simulate_dispense(self, pump_id: int, amount_ml: float, duration_ms: int, recipe_name: str):
        """Adagolás szimulálása progress update-ekkel"""
        self.pumps_active += 1
        start_time = time.time()
        duration_sec = duration_ms / 1000.0
        
        steps = int(duration_sec / 0.5)  # 500ms-enként update
        if steps < 1:
            steps = 1
        
        for i in range(steps + 1):
            if self.stop_event.is_set():
                print(f"[ESP32] Dispense stopped (emergency)")
                self.publish_error(pump_id, "EMERGENCY_STOP", "Emergency stop triggered", "warning")
                self.pumps_active -= 1
                return
            
            progress = i / steps
            current_ml = amount_ml * progress
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            # Calculate flow rate (ml/s)
            if elapsed_ms > 0:
                flow_rate = (current_ml / elapsed_ms) * 1000
            else:
                flow_rate = 0.0
            
            # Publish status
            status = {
                "pump_id": pump_id,
                "state": "dispensing" if progress < 1.0 else "idle",
                "progress_ml": round(current_ml, 2),
                "target_ml": amount_ml,
                "flow_rate_ml_s": round(flow_rate, 2),
                "elapsed_ms": elapsed_ms,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
            self.client.publish("intellivend/status", json.dumps(status), qos=0)
            print(f"[ESP32] Status: {current_ml:.1f}/{amount_ml}ml ({progress*100:.0f}%)")
            
            if i < steps:
                time.sleep(0.5)
        
        # Simulate slight variance in actual amount (+/- 5%)
        actual_ml = amount_ml * random.uniform(0.95, 1.05)
        actual_ml = round(actual_ml, 2)
        
        # Publish completion
        complete = {
            "pump_id": pump_id,
            "recipe_name": recipe_name,
            "requested_ml": amount_ml,
            "actual_ml": actual_ml,
            "duration_ms": int((time.time() - start_time) * 1000),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        self.client.publish("intellivend/dispense/complete", json.dumps(complete), qos=1)
        print(f"[ESP32] Dispense complete: {actual_ml}ml dispensed")
        
        self.pumps_active -= 1
    
    def handle_flush_command(self, payload: Dict):
        """Flush parancs kezelése"""
        pump_id = payload.get("pump_id")
        duration_ms = payload.get("duration_ms")
        
        if pump_id is None or duration_ms is None:
            self.publish_error(0, "INVALID_COMMAND", "Missing pump_id or duration_ms", "warning")
            return
        
        # Check if bulk flush (pump_id = -1)
        if pump_id == -1:
            print(f"[ESP32] Starting BULK FLUSH (all pumps), {duration_ms}ms")
            pump_ids = list(range(1, 9))  # 8 pumps
        else:
            print(f"[ESP32] Starting flush: Pump {pump_id}, {duration_ms}ms")
            pump_ids = [pump_id]
        
        # Run flush in separate thread
        thread = threading.Thread(
            target=self.simulate_flush,
            args=(pump_ids, duration_ms),
            daemon=True
        )
        thread.start()
    
    def simulate_flush(self, pump_ids: list, duration_ms: int):
        """Öblítés szimulálása"""
        self.pumps_active += len(pump_ids)
        start_time = time.time()
        duration_sec = duration_ms / 1000.0
        
        # Simulate flush
        time.sleep(duration_sec)
        
        # Publish completion for each pump
        for pump_id in pump_ids:
            complete = {
                "pump_id": pump_id,
                "action_type": "flush",
                "duration_ms": duration_ms,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
            self.client.publish("intellivend/maintenance/complete", json.dumps(complete), qos=1)
            print(f"[ESP32] Flush complete: Pump {pump_id}")
        
        self.pumps_active -= len(pump_ids)
    
    def handle_calibration_command(self, payload: Dict):
        """Kalibráció parancs kezelése"""
        pump_id = payload.get("pump_id")
        test_amount_ml = payload.get("test_amount_ml", 50.0)
        timeout_ms = payload.get("timeout_ms", 30000)
        
        print(f"[ESP32] Starting calibration: Pump {pump_id}, {test_amount_ml}ml")
        
        # Run calibration in separate thread
        thread = threading.Thread(
            target=self.simulate_calibration,
            args=(pump_id, test_amount_ml, timeout_ms),
            daemon=True
        )
        thread.start()
    
    def simulate_calibration(self, pump_id: int, test_amount_ml: float, timeout_ms: int):
        """Kalibráció szimulálása"""
        self.pumps_active += 1
        
        # Simulate dispensing test amount
        actual_duration_ms = int(test_amount_ml * random.uniform(80, 120))  # ~100ms per ml
        time.sleep(actual_duration_ms / 1000.0)
        
        # Publish completion
        complete = {
            "pump_id": pump_id,
            "action_type": "calibration",
            "test_amount_ml": test_amount_ml,
            "actual_duration_ms": actual_duration_ms,
            "ml_per_second": round(test_amount_ml / (actual_duration_ms / 1000.0), 2),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        self.client.publish("intellivend/maintenance/complete", json.dumps(complete), qos=1)
        print(f"[ESP32] Calibration complete: Pump {pump_id}, {complete['ml_per_second']} ml/s")
        
        self.pumps_active -= 1
    
    def handle_emergency_stop(self, payload: Dict):
        """Emergency stop kezelése"""
        reason = payload.get("reason", "Unknown")
        print(f"[ESP32] EMERGENCY STOP: {reason}")
        
        # Stop all operations
        self.stop_event.set()
        self.pumps_active = 0
        
        # Publish error
        self.publish_error(0, "EMERGENCY_STOP", f"Emergency stop: {reason}", "critical")
        
        # Reset after 2 seconds
        time.sleep(2)
        self.stop_event.clear()
        print(f"[ESP32] Emergency stop cleared, ready for new commands")
    
    def publish_error(self, pump_id: int, error_code: str, message: str, severity: str):
        """Hiba publikálása"""
        error = {
            "pump_id": pump_id,
            "error_code": error_code,
            "severity": severity,
            "message": message,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "context": {
                "uptime_ms": int((time.time() - self.uptime_start) * 1000),
                "pumps_active": self.pumps_active
            }
        }
        
        self.client.publish("intellivend/error", json.dumps(error), qos=1)
        print(f"[ESP32] Error published: {error_code} - {message}")
    
    def heartbeat_loop(self):
        """Heartbeat küldés 10 másodpercenként"""
        while not self.stop_event.is_set():
            if self.connected:
                uptime_ms = int((time.time() - self.uptime_start) * 1000)
                
                # Simulate WiFi RSSI (-30 to -90 dBm)
                wifi_rssi = random.randint(-90, -30)
                
                # Simulate heap memory (ESP32 has ~300KB free heap typically)
                total_heap = 327680  # bytes
                free_heap = random.randint(200000, 300000)
                
                heartbeat = {
                    "uptime_ms": uptime_ms,
                    "wifi_rssi": wifi_rssi,
                    "free_heap": free_heap,
                    "total_heap": total_heap,
                    "pumps_active": self.pumps_active,
                    "firmware_version": "MOCK_v1.0.0",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
                
                self.client.publish("intellivend/heartbeat", json.dumps(heartbeat), qos=0, retain=False)
                print(f"[ESP32] Heartbeat sent (uptime: {uptime_ms/1000:.0f}s, WiFi: {wifi_rssi}dBm)")
            
            time.sleep(10)
    
    def run(self):
        """Mock client futtatása"""
        print("=" * 60)
        print("IntelliVend ESP32 Mock Client")
        print("=" * 60)
        print(f"Broker: {self.broker}:{self.port}")
        if self.username:
            print(f"Username: {self.username}")
            print(f"Password: {'*' * len(self.password) if self.password else 'None'}")
        print(f"Error rate: {self.error_rate * 100:.1f}%")
        print("=" * 60)
        print()
        
        try:
            self.client.connect(self.broker, self.port, keepalive=120)
            self.client.loop_forever()
        except KeyboardInterrupt:
            print("\n\n[ESP32] Shutting down...")
            self.stop_event.set()
            self.client.disconnect()
            print("[ESP32] Goodbye!")
        except Exception as e:
            print(f"[ESP32] Fatal error: {e}")

def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description="IntelliVend ESP32 Mock Client - MQTT szimulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Példák:
  # Alap futtatás (default broker)
  python3 esp32_mock.py
  
  # Egyedi broker
  python3 esp32_mock.py --broker 192.168.1.100 --port 1883
  
  # Username és password használatával
  python3 esp32_mock.py --username mqtt_user --password secret123
  
  # 10% hiba generálás teszteléshez
  python3 esp32_mock.py --error-rate 0.1
        """
    )
    
    parser.add_argument(
        "--broker",
        default="192.168.0.55",
        help="MQTT broker IP címe (default: 192.168.0.55)"
    )
    
    parser.add_argument(
        "--port",
        type=int,
        default=1883,
        help="MQTT broker port (default: 1883)"
    )
    
    parser.add_argument(
        "--username",
        default=None,
        help="MQTT username (opcionális)"
    )
    
    parser.add_argument(
        "--password",
        default=None,
        help="MQTT password (opcionális)"
    )
    
    parser.add_argument(
        "--error-rate",
        type=float,
        default=0.0,
        help="Hibák generálásának valószínűsége 0.0-1.0 (default: 0.0)"
    )
    
    args = parser.parse_args()
    
    # Validate error rate
    if not 0.0 <= args.error_rate <= 1.0:
        print("Error rate must be between 0.0 and 1.0")
        return 1
    
    # Create and run mock client
    mock = ESP32Mock(
        broker=args.broker,
        port=args.port,
        username=args.username,
        password=args.password,
        error_rate=args.error_rate
    )
    
    mock.run()
    return 0

if __name__ == "__main__":
    exit(main())
