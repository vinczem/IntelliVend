# IntelliVend ESP32 Firmware - Arduino IDE Setup

## Hardware követelmények

- **ESP32-S3-DEV-N16R8** (16MB Flash, 8MB PSRAM)
- **8x Micro Peristaltic Pump** (DC 6V-12V, 500 motor, planetary deceleration)
- **8x YF-S201 Hall Effect Water Flow Sensor** (~450 pulzus/liter)
- **8-Channel Relay Board** (pumpa vezérléshez)
- **12V DC tápegység** (pumpákhoz)
- **5V DC tápegység vagy USB** (ESP32-hez)

## Arduino IDE telepítés

### 1. Arduino IDE feltelepítése

Töltsd le és telepítsd az Arduino IDE-t (2.0 vagy újabb ajánlott):
https://www.arduino.cc/en/software

### 2. ESP32 Board Manager telepítése

1. Arduino IDE → File → Preferences
2. Additional Boards Manager URLs mezőbe:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Tools → Board → Boards Manager
4. Keress rá: "esp32"
5. Telepítsd: "esp32 by Espressif Systems" (2.0.14 vagy újabb)

### 3. Szükséges könyvtárak telepítése

Tools → Manage Libraries, majd telepítsd:

- **PubSubClient** by Nick O'Leary (2.8.0 vagy újabb)
  - MQTT kommunikációhoz
  
- **ArduinoJson** by Benoit Blanchon (6.21.0 vagy újabb)
  - JSON üzenetek feldolgozásához

**Megjegyzés:** A WiFi könyvtár már beépített az ESP32 package-be.

## Projekt konfiguráció

### 1. config.h létrehozása

Másold át a `config.h.sample` fájlt `config.h` névre az `IntelliVend_ESP32` mappában:

```bash
cd IntelliVend_ESP32
copy config.h.sample config.h
```

**Vagy Windows Explorerben:** Jobb klikk a `config.h.sample` fájlra → Copy → Paste → nevezd át `config.h`-ra

### 2. config.h szerkesztése

Nyisd meg a `config.h` fájlt és állítsd be:

```cpp
// WiFi hálózatod
#define WIFI_SSID "Your_WiFi_Name"
#define WIFI_PASSWORD "Your_WiFi_Password"

// Home Assistant IP címe
#define MQTT_BROKER "192.168.1.100"
#define MQTT_PORT 1883

// MQTT felhasználónév/jelszó (ha szükséges)
#define MQTT_USER "intellivend"
#define MQTT_PASSWORD "your_mqtt_password"
```

### 3. GPIO Pin konfiguráció

A `config.h` fájlban ellenőrizd a pumpa relay és flow meter pineket:

```cpp
// Pumpa relay pinek (8-csatornás relay board)
#define PUMP_1_PIN 2
#define PUMP_2_PIN 4
#define PUMP_3_PIN 5
#define PUMP_4_PIN 6
#define PUMP_5_PIN 7
#define PUMP_6_PIN 15
#define PUMP_7_PIN 16
#define PUMP_8_PIN 17

// YF-S201 áramlásmérő pinek
#define FLOW_METER_1_PIN 8
#define FLOW_METER_2_PIN 9
#define FLOW_METER_3_PIN 10
#define FLOW_METER_4_PIN 11
#define FLOW_METER_5_PIN 12
#define FLOW_METER_6_PIN 13
#define FLOW_METER_7_PIN 14
#define FLOW_METER_8_PIN 18

// Status LED
#define STATUS_LED_PIN 21
```

**⚠️ FONTOS:** ESP32-S3-DEV-N16R8 **CSAK az alábbi GPIO-kat** használja:
- **1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21**
- **35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 48**
- **GPIO 19-34 NEM LÉTEZIK** (SPI Flash-nek fenntartva)!


## Fordítás és feltöltés

### 1. Board kiválasztása

- Tools → Board → esp32 → **ESP32S3 Dev Module**

### 2. Board beállítások

```
Board: "ESP32S3 Dev Module"
USB CDC On Boot: "Enabled"
CPU Frequency: "240MHz (WiFi)"
Flash Mode: "QIO 80MHz"
Flash Size: "16MB (128Mb)"
Partition Scheme: "16M Flash (3M APP/9.9M FATFS)"
PSRAM: "OPI PSRAM"
Upload Speed: "921600"
```

### 3. Port kiválasztása

- Tools → Port → Válaszd ki az ESP32 COM portját (pl. COM3, COM4)

### 4. Fordítás és feltöltés

1. Nyisd meg a `IntelliVend_ESP32.ino` fájlt az Arduino IDE-vel
2. Kattints a **Verify** gombra (fordítás tesztelése)
3. Ha sikeres, kattints a **Upload** gombra (feltöltés)

### 5. Serial monitor

- Tools → Serial Monitor
- Baud rate: **115200**
- Figyeld az indítási üzeneteket és MQTT csatlakozást!

## Hardware bekötés

### Relay Board csatlakoztatás

```
ESP32 GPIO → Relay Channel → Pumpa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GPIO 2    →  CH1  →  Pumpa 1
GPIO 4    →  CH2  →  Pumpa 2
GPIO 5    →  CH3  →  Pumpa 3
GPIO 18   →  CH4  →  Pumpa 4
GPIO 19   →  CH5  →  Pumpa 5
GPIO 21   →  CH6  →  Pumpa 6
GPIO 22   →  CH7  →  Pumpa 7
GPIO 23   →  CH8  →  Pumpa 8

Relay VCC → 5V (külső tápról ajánlott!)
Relay GND → GND
```

### YF-S201 Flow Sensor csatlakoztatás

Minden flow sensorhoz 3 vezeték:
- **Piros (VCC):** 5V
- **Fekete (GND):** GND
- **Sárga (Signal):** ESP32 GPIO (FLOW_METER_X_PIN)

```
Flow Sensor → ESP32 GPIO
━━━━━━━━━━━━━━━━━━━━━━━━
Sensor 1   →  GPIO 14
Sensor 2   →  GPIO 12
Sensor 3   →  GPIO 13
Sensor 4   →  GPIO 15
Sensor 5   →  GPIO 16
Sensor 6   →  GPIO 17
Sensor 7   →  GPIO 33 ⚠️
Sensor 8   →  GPIO 34 ⚠️
```
**⚠️ FIGYELEM:** GPIO 22-32 **NEM ELÉRHETŐ** ESP32-S3-on (SPI Flash)!

### Pumpa bekötés

```
Pumpa → Relay NO (Normally Open) → 12V+
Pumpa GND → 12V GND közös
```

**FONTOS:** A relay kapcsoló **aktív HIGH** - a pumpák akkor indulnak, amikor a GPIO HIGH.

## Tesztelés

### 1. WiFi és MQTT Kapcsolat

Serial Monitor kimenet:
```
[WiFi] Connected!
[WiFi] IP Address: 192.168.1.xxx
[MQTT] Connected!
[MQTT] Subscribed to topics
[INFO] System ready!
```

### 2. Flow Sensor tesztelés

Fújj a flow sensorba vagy forgasd meg kézzel a lapátokat (ha hozzáférhető):
```
[PUMP 1] Progress: 5.2/50.0 ml (10%)
```

### 3. MQTT parancsok

Home Assistant-ból vagy MQTT klienssel küldd:

**Öblítés:**
```json
Topic: intellivend/maintenance/flush
{
  "pump_id": 1,
  "duration_ms": 5000
}
```

**Kalibrálás:**
```json
Topic: intellivend/calibration/start
{
  "pump_id": 1,
  "test_amount_ml": 100.0,
  "timeout_ms": 30000
}
```

## Kalibrálás

### 1. Flow Sensor kalibrálás

A YF-S201 gyári értéke ~450 pulses/liter, de változhat:

1. Indíts kalibráló tesztet 100 ml-rel
2. Mérj le pontosan edénybe
3. Nézd meg a Serial monitor kiírást:
   ```
   Suggested calibration factor: 0.9850
   ```
4. Frissítsd a `config.h`-ban a `PUMP_X_CALIBRATION` értéket

### 2. Pumpa teljesítmény finomhangolás

Ha a pumpa túl sokat vagy túl keveset adagol:

```cpp
// config.h
#define PUMP_1_CALIBRATION 1.05  // +5% több folyadék
#define PUMP_2_CALIBRATION 0.98  // -2% kevesebb folyadék
```

## Hibaelhárítás

### WiFi nem csatlakozik
- Ellenőrizd az SSID és jelszó helyességét
- 2.4 GHz WiFi kell (ESP32 nem támogatja az 5 GHz-et)

### MQTT nem csatlakozik
- Ping-eld a broker IP-jét
- Ellenőrizd a Mosquitto add-on fut-e Home Assistant-ban
- Nézd meg a felhasználónév/jelszó helyes-e

### Flow sensor nem működik
- Ellenőrizd a 5V tápellátást
- Pull-up ellenállás már beépített a kódban (INPUT_PULLUP)
- Forgasd meg kézzel a turbinát, kell érzékelnie

### Relay nem kapcsol
- Ellenőrizd a relay tápellátását (külön 5V ajánlott)
- Optokupleres relay esetén lehet, hogy invertálni kell a jelet

## Frissítések

A legfrissebb firmware verzió:
https://github.com/vinczem/IntelliVend

## Licensz

MIT License - IntelliVend Team 2025
