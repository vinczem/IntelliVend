# IntelliVend Home Assistant Add-on

![IntelliVend Logo](https://raw.githubusercontent.com/vinczem/IntelliVend/main/frontend/icon-192.svg)

## Intelligens Italautomata Rendszer

Az IntelliVend egy teljes körű italautomata rendszer Home Assistant-hez, amely lehetővé teszi koktélok és italok automatizált előkészítését ESP32 alapú hardverrel.

## Funkciók

- **Recept kezelés**: Koktélok és italok receptjeinek létrehozása, szerkesztése
- **Automatizált adagolás**: Precíz mennyiségű alapanyagok adagolása többpontos pumpákkal
- **Készlet nyilvántartás**: Valós idejű nyomon követés és alacsony készlet riasztások
- **Modern Web UI**: Reszponzív, touch-friendly kezelőfelület
- **MQTT integráció**: ESP32 vezérlés MQTT protokollal
- **Home Assistant Discovery**: Automatikus entitások létrehozása szenzorokkal és riasztásokkal
- **Statisztikák**: Részletes adagolási előzmények és fogyasztási adatok
- **Karbantartás**: Pumpa kalibráció és diagnosztika
- **Riasztások**: Email értesítések alacsony készlet esetén
- **Backup/Restore**: Teljes adatbázis mentés és visszaállítás

## Telepítés

### 1. Add-on Repository hozzáadása

1. Nyisd meg a Home Assistant-ot
2. Navigálj a **Settings** → **Add-ons** → **Add-on Store** menüponthoz
3. Kattints a jobb felső sarokban lévő három pontra (⋮)
4. Válaszd a **Repositories** opciót
5. Add hozzá ezt a repository URL-t:
   ```
   https://github.com/vinczem/IntelliVend
   ```

### 2. Add-on telepítése

1. Frissítsd az Add-on Store-t
2. Keresd meg az **IntelliVend** add-ont
3. Kattints rá és válaszd az **Install** opciót
4. Várd meg a telepítés befejezését

### 3. Konfiguráció

#### MQTT beállítása

Ha ESP32 eszközzel szeretnél kommunikálni, MQTT broker szükséges:

1. Telepítsd a **Mosquitto broker** add-ont
2. Konfiguráld a felhasználókat és jogosultságokat

#### IntelliVend konfiguráció

A Konfiguráció lapon állítsd be az MQTT kapcsolatot:

```yaml
mqtt_broker: core-mosquitto
mqtt_port: 1883
mqtt_user: intellivend
mqtt_password: your_mqtt_password
log_level: info
```

Az IntelliVend emailt küld, ha valamelyik alapanyag fogyóban van, vagy esetleg elfogyott.
Ehhez add meg az Email fiók SMTP beállításait:

```yaml
smtp_host
smtp_port
smtp_user
smtp_password
alert_email
```

### 4. Indítás

1. Kattints a **Start** gombra
2. Engedélyezd a **Start on boot** opciót
3. Ellenőrizd a logokat, hogy minden rendben elindult-e

### 5. Hozzáférés

Az add-on elérhető:
- **Ingress-en keresztül**: Kattints a **Webes kezelőfelület megnyitása** gombra
- **Közvetlen elérés**: `http://homeassistant.local:8099`
- **API Dokumentáció (Swagger)**: `http://homeassistant.local:8099/api/docs`

## Első lépések

1. **ESP32 konfigurálása**: 
   - Használd az `/esp32/config.h.sample` fájlt sablonként
   - Állítsd be a WiFi és MQTT paramétereket
   - Töltsd fel a kódot az ESP32-re

2. **Alapanyagok felvitele**:
   - Navigálj az Ingredients (Alapanyagok) menüponthoz
   - Add hozzá az italautomatádban található alapanyagokat

3. **Pumpák beállítása**:
   - A Pumpák menüpontban rendeld hozzá az alapanyagokat a pumpákhoz
   - Állítsd be a GPIO pineket

4. **Készlet feltöltése**:
   - A Készlet menüpontban rögzítsd a palackok méretét és bennük lévő folyadék mennyiségét

5. **Receptek létrehozása**:
   - A Receptek menüben hozz létre koktél recepteket
   - Állítsd be az alapanyagok mennyiségét
   - Tölts fel képet az italról (opcionális, a recept rögzítése után elérhető)

6. **Adagolás**:
   - Az Italok menüpontból indítsd el az italok készítését

## Konfigurációs opciók

### MQTT beállítások

- **mqtt_broker**: MQTT broker címe (alapértelmezett: `core-mosquitto`)
- **mqtt_port**: MQTT port (alapértelmezett: `1883`)
- **mqtt_user**: MQTT felhasználónév (opcionális)
- **mqtt_password**: MQTT jelszó (opcionális)

### MQTT beállítások
- **smtp_host**: Az SMTP szerver címe (pl. `smtp.google.com`)
- **smtp_port**: és portja (pl. `587`)
- **smtp_user**: SMTP felhasználónév
- **smtp_password**: SMTP jelszó
- **alert_email**: A levelek címzettje

### Egyéb beállítások

- **log_level**: Naplózási szint (`debug`, `info`, `warning`, `error`)

## Hardver Követelmények

### ESP32 Modul
- ESP32 DevKit v1 vagy kompatibilis
- Minimum 4MB Flash memória

### Pumpák
- 12V perisztaltikus pumpák (ajánlott)
- Relay modul vagy MOSFET vezérlés

### Áramlásmérők (opcionális)
- Folyásmérő szenzorok a pontos adagoláshoz

### Táp
- 12V tápegység (minimum 5A a pumpák számától függően)

## MQTT Topicok

Az ESP32 és a Backend a következő MQTT topicokat használja:

### ESP32 ↔ Backend kommunikáció

**Publikált topicok (ESP32 → Backend):**
- `intellivend/status` - Valós idejű pumpa állapot frissítések
- `intellivend/dispense/complete` - Adagolás befejezve
- `intellivend/maintenance/complete` - Öblítés/karbantartás befejezve
- `intellivend/error` - Hibaüzenetek
- `intellivend/heartbeat` - ESP32 életjel (WiFi, memória, üzemidő)

**Feliratkozott topicok (Backend → ESP32):**
- `intellivend/dispense/command` - Adagolás indítása
- `intellivend/maintenance/flush` - Öblítés indítása
- `intellivend/calibration/start` - Kalibrálás indítása
- `intellivend/emergency/stop` - Vészleállítás

### Home Assistant Discovery topicok

**Discovery config (Backend → Home Assistant, retain=true):**
- `homeassistant/sensor/intellivend/{entity_id}/config` - Szenzor konfigurációk
- `homeassistant/binary_sensor/intellivend/{entity_id}/config` - Bináris szenzor konfigurációk

**Állapot topicok (Backend → Home Assistant):**
- `intellivend/ha/availability` - Rendszer elérhetőség ("online"/"offline")
- `intellivend/ha/esp32/wifi` - ESP32 WiFi jelerősség
- `intellivend/ha/esp32/memory` - ESP32 memória használat
- `intellivend/ha/esp32/uptime` - ESP32 üzemidő
- `intellivend/ha/esp32/active_pumps` - Aktív pumpák száma
- `intellivend/ha/esp32/status` - ESP32 kapcsolat állapot
- `intellivend/ha/pump/{1-8}/level` - Pumpa készlet szintek
- `intellivend/ha/pump/{1-8}/alert` - Pumpa riasztások (alacsony/üres)
- `intellivend/ha/last_dispense` - Utolsó adagolt ital adatai
- `intellivend/ha/alerts/low_stock` - Rendszer szintű alacsony készlet riasztás
- `intellivend/ha/alerts/empty_bottle` - Rendszer szintű üres palack riasztás

## Home Assistant Integráció

Az add-on automatikusan létrehoz Home Assistant entitásokat MQTT Discovery-n keresztül:

### Szenzorok

**ESP32 Státusz:**
- `sensor.esp32_wifi_signal` - WiFi jelerősség (dBm)
- `sensor.esp32_memory_usage` - Memória használat (%)
- `sensor.esp32_uptime` - ESP32 üzemidő
- `sensor.esp32_active_pumps` - Aktív pumpák száma
- `binary_sensor.esp32_online` - ESP32 kapcsolat állapot

**Pumpa/Alapanyag Szenzorok (1-8):**
- `sensor.pump_X_level` - Aktuális mennyiség (ml)
  - Attributes: ingredient_name, current_ml, max_ml, percentage, is_alcoholic
- `binary_sensor.pump_X_low_stock` - Alacsony készlet riasztás
- `binary_sensor.pump_X_empty` - Üres palack riasztás

**Utolsó adagolás:**
- `sensor.last_dispensed_drink` - Utoljára készített ital neve
  - Attributes: recipe_name, timestamp, duration_seconds, total_ml, time_ago

**Rendszer riasztások:**
- `binary_sensor.system_low_stock_alert` - Van-e bármely alacsony készlet
- `binary_sensor.system_empty_bottle_alert` - Van-e üres palack

### Automációk példák

**Értesítés alacsony készlet esetén:**
```yaml
automation:
  - alias: "IntelliVend - Low Stock Alert"
    trigger:
      - platform: state
        entity_id: binary_sensor.system_low_stock_alert
        to: "on"
    action:
      - service: notify.mobile_app
        data:
          title: "IntelliVend Riasztás"
          message: "Alacsony alapanyag készlet!"
```

**Napi összegző:**
```yaml
automation:
  - alias: "IntelliVend - Daily Summary"
    trigger:
      - platform: time
        at: "23:00:00"
    action:
      - service: notify.mobile_app
        data:
          title: "IntelliVend Napzáró"
          message: "Utolsó ital: {{ states('sensor.last_dispensed_drink') }}"
```

### Dashboard Kártya Példa

```yaml
type: entities
title: IntelliVend
entities:
  - entity: binary_sensor.esp32_online
    name: ESP32 Kapcsolat
  - entity: sensor.esp32_wifi_signal
    name: WiFi Jel
  - entity: sensor.pump_1_level
    name: Vodka
  - entity: sensor.pump_2_level
    name: Gin
  - entity: sensor.last_dispensed_drink
    name: Utolsó ital
  - entity: binary_sensor.system_low_stock_alert
    name: Készlet Riasztás
```

## Támogatás

- **GitHub Issues**: https://github.com/vinczem/IntelliVend/issues
- **Dokumentáció**: https://github.com/vinczem/IntelliVend
- **ESP32 Mock tool**: A repository tartalmaz egy mock eszközt teszteléshez

## Licenc

MIT License - részletek a LICENSE fájlban

## Köszönetnyilvánítás

Fejlesztette: Zoltan Nagy és Mihaly Vincze

---

**Figyelem**: Ez egy közösségi projekt. Használat előtt győződj meg róla, hogy az elektromos és mechanikai komponensek biztonságosan vannak felszerelve. Az italok fogyasztása saját felelősségre történik.
