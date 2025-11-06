# IntelliVend - Intelligens Italautomata Rendszer

![IntelliVend](frontend/icon-192.svg)

## Bemutatkozás

Az IntelliVend egy IoT alapú italautomata rendszer, amely ESP32 mikrokontrollerrel, Node.js backenddel és modern webes kezelőfelülettel rendelkezik. A rendszer lehetővé teszi koktélok és italok automatizált elkészítését, készletkezelést, statisztikák vezetését és Home Assistant integrációt.

## Főbb funkciók

- **Recept kezelés**: Koktélok és italok receptjeinek létrehozása, módosítása
- **Automatizált adagolás**: Több pumpa egyidejű vezérlése precíz mennyiségekkel
- **Készlet nyilvántartás**: Valós idejű követés, alacsony készlet riasztások
- **Modern Web UI**: Reszponzív, érintőképernyő-barát kezelőfelület
- **MQTT kommunikáció**: ESP32 eszköz vezérlés MQTT protokollal
- **Statisztikák**: Részletes adagolási előzmények és elemzések
- **Karbantartás**: Pumpa kalibráció és diagnosztika
- **Email riasztások**: Automatikus értesítések alacsony készlet esetén
- **Backup/Restore**: Teljes adatbázis mentés és visszaállítás
- **Home Assistant**: Teljes integráció add-on formájában

## Home Assistant Add-on

Ez a projekt elérhető Home Assistant add-onként is!

### Telepítés

1. Add hozzá ezt a repository-t a Home Assistant Add-on Store-hoz:
   ```
   https://github.com/vinczem/IntelliVend
   ```

2. Telepítsd az **IntelliVend** add-ont

3. Konfiguráld a MySQL és MQTT beállításokat

4. Indítsd el az add-ont

Részletes telepítési útmutató: [Add-on README](homeassistant-addon/intellivend/README.md)

## Projekt struktúra

```
IntelliVend/
├── backend/              # Node.js API szerver
│   ├── config/          # Konfigurációs fájlok (database, MQTT, logger)
│   ├── routes/          # API végpontok
│   └── services/        # Szolgáltatások (email, Home Assistant)
│   ├── css/            # Stíluslapok
│   └── js/             # JavaScript modulok
├── database/            # SQL sémák és seed adatok
├── IntelliVend_ESP32/  # ESP32 firmware (Arduino IDE)
│   ├── IntelliVend_ESP32.ino  # Fő firmware fájl
│   ├── config.h.sample        # Konfiguráció minta
│   ├── README.md              # ESP32 projekt áttekintő
│   └── README_ARDUINO.md      # Arduino IDE részletes útmutató
├── homeassistant-addon/ # Home Assistant integráció
│   └── intellivend/    # Add-on fájlok
├── docker/             # Docker konfigurációk
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
```
└── tools/              # Fejlesztői eszközök (ESP32 mock, stb.)
```

## Gyors Kezdés

### Docker-rel (ajánlott)

```bash
# Repository klónozása
git clone https://github.com/vinczem/IntelliVend.git
cd IntelliVend

# Docker konténerek indítása
cd docker
docker-compose up -d

# Frontend: http://localhost:8099
# Backend API: http://localhost:3000
```

### Manuális telepítés

#### Követelmények
- Node.js 18+ és npm
- MySQL 8.0+ vagy MariaDB 10.6+
- MQTT Broker (pl. Mosquitto)
- ESP32-S3 fejlesztői környezet (Arduino IDE)

#### Backend

```bash
cd backend
npm install
cp .env.example .env
# Szerkeszd a .env fájlt a beállításokkal
npm start
```

#### Adatbázis

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p intellivend < database/seed.sql
```

#### Frontend

Használj egy webszervert (pl. Nginx) a frontend könyvtár kiszolgálásához, vagy használd a Docker verziót.

#### ESP32 Firmware (Arduino IDE - Ajánlott)

**Részletes útmutató:** [IntelliVend_ESP32/README_ARDUINO.md](IntelliVend_ESP32/README_ARDUINO.md)

```bash
# 1. Nyisd meg az Arduino IDE-t
# 2. File → Open → IntelliVend_ESP32/IntelliVend_ESP32.ino
# 3. Másold a config.h.sample-t config.h-ra és szerkeszd
# 4. Tools → Board → ESP32S3 Dev Module
# 5. Tools → Port → Válaszd ki az ESP32 portját
# 6. Kattints az Upload gombra
```

**Részletes útmutató:** [IntelliVend_ESP32/README_ARDUINO.md](IntelliVend_ESP32/README_ARDUINO.md)

## Konfiguráció

### Backend (.env)

```env
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=intellivend
DB_USER=intellivend
DB_PASSWORD=your_password

MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
```

### ESP32 (config.h)

```cpp
// WiFi beállítások
#define WIFI_SSID "your_wifi_name"
#define WIFI_PASSWORD "your_wifi_password"

// MQTT beállítások
#define MQTT_BROKER "192.168.1.100"  // Home Assistant IP
#define MQTT_PORT 1883
#define MQTT_USER "intellivend"
#define MQTT_PASSWORD "your_mqtt_password"

// Hardware konfiguráció - ESP32-S3-DEV-N16R8
// Pumpa GPIO pinek (8-csatornás relay board)
#define PUMP_1_PIN 2
#define PUMP_2_PIN 4
// ... további pumpák

// YF-S201 áramlásmérő pinek
#define FLOW_METER_1_PIN 14
#define FLOW_METER_2_PIN 12
// ... további szenzorok
```

## MQTT topicok

### ESP32 → Backend (Publish)
- `intellivend/heartbeat` - Eszköz állapot (5 percenként)
- `intellivend/dispense/complete` - Adagolás befejezve
- `intellivend/maintenance/complete` - Karbantartás befejezve
- `intellivend/error` - Hibaüzenetek

### Backend → ESP32 (Subscribe)
- `intellivend/dispense/command` - Adagolás indítása
- `intellivend/maintenance/flush` - Pumpa öblítés
- `intellivend/calibration/start` - Kalibráció indítása
- `intellivend/emergency/stop` - Vészleállítás

### Példa üzenet (Dispense)

```json
{
  "pump_id": 6,
  "amount_ml": [
    {
      "pump_number": 6,
      "quantity_ml": 200,
      "ingredient": "Narancslé",
      "order": 1
    }
  ],
  "recipe_name": "Orange Juice",
  "timestamp": "2025-11-06T10:15:28.046Z"
}
```

**Fontos:** Az ESP32 a `pump_number` alapján határozza meg a GPIO pin-t (config.h-ban definiálva).

## Hardver

### ESP32 Alkatrészlista
- **ESP32-S3-DEV-N16R8** (16MB Flash, 8MB PSRAM)
- **8x Micro Peristaltic Pump** (DC 6-12V, 500 motor, planetary deceleration)
- **8x YF-S201 Hall Effect Water Flow Sensor** (~450 pulzus/liter)
- **8-Channel Relay Board** (pumpa vezérléshez)
- **12V/5A+ tápegység** (pumpákhoz)
- **5V tápegység vagy USB** (ESP32, relay, szenzorok)
- **Csövek, csatlakozók**

### GPIO Pin kiosztás

**Relay vezérlés (pumpák):**
```
Pump 1-8 → GPIO: 2, 4, 5, 18, 19, 21, 22, 23
```

**YF-S201 Flow sensorok:**
```
Sensor 1-8 → GPIO: 14, 12, 13, 15, 16, 17, 25, 26
```

### Kapcsolási rajz
Részletes bekötési útmutató: [IntelliVend_ESP32/README_ARDUINO.md](IntelliVend_ESP32/README_ARDUINO.md)

## API dokumentáció

A backend REST API a következő végpontokat biztosítja:

### Főbb Endpointok

- `GET /api/recipes` - Receptek listázása
- `POST /api/recipes` - Új recept létrehozása
- `GET /api/ingredients` - Alapanyagok listázása
- `POST /api/ingredients` - Új alapanyag hozzáadása
- `GET /api/pumps` - Pumpák listázása
- `GET /api/inventory` - Készlet lekérdezése
- `POST /api/dispense` - Adagolás indítása
- `GET /api/stats` - Statisztikák
- `POST /api/maintenance/flush/:pump_id` - Pumpa öblítés

### Példák

```bash
# Összes recept lekérése
curl http://localhost:3000/api/recipes

# Új alapanyag hozzáadása
curl -X POST http://localhost:3000/api/ingredients \
  -H "Content-Type: application/json" \
  -d '{"name":"Vodka","type":"alcohol","alcohol_percentage":40}'

# Adagolás indítása
curl -X POST http://localhost:3000/api/dispense \
  -H "Content-Type: application/json" \
  -d '{"recipe_id":1,"strength":"normal"}'

# Pumpa öblítés
curl -X POST http://localhost:3000/api/maintenance/flush/1 \
  -H "Content-Type: application/json" \
  -d '{"duration_ms":5000}'
```

## Fejlesztés

### Mock ESP32 használata

Teszteléshez használható egy Python script, ami szimulálja az ESP32 eszközt:

```bash
cd tools
python esp32_mock.py
```

### Tesztelés

```bash
cd backend
npm test
```

### Debug mód

Backend debug mód:
```bash
cd backend
DEBUG=* npm start
```

ESP32 Serial monitor (Arduino IDE):
```
Tools → Serial monitor → Baud: 115200
```

## Hozzájárulás

A hozzájárulásokat szívesen fogadjuk! Kérjük:

1. Fork-old a repository-t
2. Hozz létre egy feature branch-et (`git checkout -b feature/amazing-feature`)
3. Commit-old a változtatásokat (`git commit -m 'Add amazing feature'`)
4. Push-old a branch-et (`git push origin feature/amazing-feature`)
5. Nyiss egy Pull Request-et

## Licensz

Ez a projekt MIT licensz alatt áll. Részletek a [LICENSE](LICENSE) fájlban.

## Fejlesztők

- **Zoltan Nagy**, **Mihaly Vincze**

## Köszönetnyilvánítás

- Home Assistant közösség
- Minden nyílt forráskódú projekt, amit használtunk

## Támogatás

- **GitHub Issues**: https://github.com/vinczem/IntelliVend/issues
- **Dokumentáció**: 
  - [ESP32 Arduino IDE útmutató](IntelliVend_ESP32/README_ARDUINO.md)
  - [Home Assistant Add-on](homeassistant-addon/intellivend/README.md)

---

**Figyelmeztetés:** Az elektromos és mechanikai alkatrészek használata veszélyes lehet. Mindig bizonyosodj meg róla, hogy a berendezésed biztonságosan van felépítve. Az alkoholos italok fogyasztása saját felelősségre történik.

**Üzemeltetés során az adott ország törvényeinek betartása kötelező!**
