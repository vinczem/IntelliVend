# IntelliVend ESP32 Firmware

ESP32-S3 alapú firmware peristaltikus pumpás italautomatához YF-S201 áramlásmérőkkel.

## Gyors kezdés

### Arduino IDE használat (AJÁNLOTT)

1. **Nyisd meg a projektet:**
   - Arduino IDE → File → Open
   - Válaszd ki: `IntelliVend_ESP32/IntelliVend_ESP32.ino`

2. **Konfiguráció:**
   ```bash
   copy config.h.sample config.h
   ```
   Szerkeszd a `config.h` fájlt (WiFi, MQTT beállítások)

3. **Feltöltés:**
   - Board: **ESP32S3 Dev Module**
   - Port: Válaszd ki az ESP32 COM portját
   - Upload gomb

**Részletes Arduino IDE útmutató:** [README_ARDUINO.md](README_ARDUINO.md)

## Hardware

- **MCU:** ESP32-S3-DEV-N16R8 (16MB Flash, 8MB PSRAM)
- **Pumpák:** 8x Peristaltic Pump (DC 6-12V)
- **Áramlásmérők:** 8x YF-S201 Hall Effect Sensor
- **Vezérlés:** 8-Channel Relay Board
- **Tápellátás:** 12V (pumpák), 5V (ESP32, relay, szenzorok)

## MQTT Topics

### Feliratkozás (Subscribe)
- `intellivend/dispense/command` - Adagolási parancs
- `intellivend/maintenance/flush` - Pumpa öblítés
- `intellivend/calibration/start` - Kalibrálás indítása
- `intellivend/emergency/stop` - Vészleállítás

### Publikálás (Publish)
- `intellivend/heartbeat` - Rendszerállapot (5 percenként)
- `intellivend/dispense/complete` - Adagolás befejezve
- `intellivend/maintenance/complete` - Karbantartás befejezve
- `intellivend/error` - Hibaüzenetek

## GPIO Pin Kiosztás

**⚠️ ESP32-S3-DEV-N16R8 Elérhető GPIO-k:**
```
1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21
35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 48
```
**❌ GPIO 19-34 NEM LÉTEZIK** (SPI Flash-nek fenntartva)!

### Relay Vezérlés (Pumpák)
```
Pump 1 → GPIO 2
Pump 2 → GPIO 4
Pump 3 → GPIO 5
Pump 4 → GPIO 6
Pump 5 → GPIO 7
Pump 6 → GPIO 15
Pump 7 → GPIO 16
Pump 8 → GPIO 17
```

### YF-S201 Flow Sensorok
```
Flow Meter 1 → GPIO 8
Flow Meter 2 → GPIO 9
Flow Meter 3 → GPIO 10
Flow Meter 4 → GPIO 11
Flow Meter 5 → GPIO 12
Flow Meter 6 → GPIO 13
Flow Meter 7 → GPIO 14
Flow Meter 8 → GPIO 18
```

### Egyéb
```
Status LED → GPIO 21
```

## Fontos jellemzők

**Interrupt alapú áramlásmérés** - Precíz mennyiségmérés YF-S201 szenzorokkal (~450 pulse/liter)

**Real-time flow monitoring** - 2 másodpercenként progress report adagolás közben

**Automatikus timeout védelem** - 60 másodperces maximum futási idő pumpánként

**Kalibrálási mód** - Pontos mérés és calibration factor számítás

**Öblítési funkció** - Egyedi vagy összes pumpa tisztítása

**WiFi auto-reconnect** - Automatikus újracsatlakozás hálózati hiba esetén

## Serial Monitor Output Példa

```
=================================
IntelliVend ESP32-S3 Firmware
Version: 2.0.0
Device ID: intellivend_esp32_001
Hardware: ESP32-S3-DEV-N16R8
Pumpák: 8x Peristaltic + Relay
Sensors: 8x YF-S201 Flow Meter
=================================

[INIT] Configuring pump relay pins...
  Pump 1 -> GPIO 2
  Pump 2 -> GPIO 4
  ...
[INIT] Configuring YF-S201 flow meters...
  Flow Meter 1 -> GPIO 14
  ...
[WiFi] Connected!
[WiFi] IP Address: 192.168.1.150
[MQTT] Connected!
[MQTT] Subscribed to topics
[INFO] System ready!

╔════════════════════════════════════════╗
║ DISPENSE: Mojito
║ Ingredients: 4
╚════════════════════════════════════════╝

[1/4] Pump 1: 50.0 ml of Rum
[PUMP 1] Target: 50.0 ml (22 pulses)
[PUMP 1] Progress: 15.2/50.0 ml (30%)
[PUMP 1] Progress: 32.8/50.0 ml (66%)
[PUMP 1] Complete: 50.2 ml in 5234 ms

...

Dispense complete!
```

## Hibaelhárítás

**WiFi nem csatlakozik:**
- Csak 2.4 GHz támogatott
- Ellenőrizd az SSID/jelszó helyességét

**MQTT nem csatlakozik:**
- Ping-eld a broker IP-t
- Ellenőrizd a Mosquitto add-on fut-e
- Nézd meg a user/pass helyes-e

**Flow sensor nem működik:**
- 5V tápellátás szükséges
- Próbáld meg kézzel forgatni a turbinát
- Ellenőrizd a GPIO pin számot

**Relay nem kapcsol:**
- Külső 5V tápellátás ajánlott relay board-nak
- Optokupleres relay esetén polaritás ellenőrzés

## Licensz

MIT License - IntelliVend Team 2025

## Linkek

- **Arduino IDE útmutató:** [README_ARDUINO.md](README_ARDUINO.md)
- **Projekt GitHub:** https://github.com/vinczem/IntelliVend
- **Home Assistant Add-on:** [../homeassistant-addon/intellivend/](../homeassistant-addon/intellivend/)
