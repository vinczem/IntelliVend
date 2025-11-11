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

### Alkatrészlista
- **ESP32-S3-DEV-N16R8** (16MB Flash, 8MB PSRAM)
  Hestore: https://www.hestore.hu/prod_10048179.html (4582 Ft)
- **8x Micro Peristaltic Pump** (DC 6-12V, 500 motor, planetary deceleration)
  Ali: https://www.aliexpress.com/item/1005008196853992.html?spm=a2g0o.order_list.order_list_main.5.4d5518023nx9sv (4.37 USD)
- **8x YF-S201 Hall Effect Water Flow Sensor** (~450 pulzus/liter)
  Ali: https://www.aliexpress.com/item/1005008196853992.html?spm=a2g0o.order_list.order_list_main.5.4d5518023nx9sv (3.30 USD)
  Hestore: https://www.hestore.hu/prod_10036440.html (2089 Ft)
- **8-Channel Relay Board** (pumpa vezérléshez)
  Hestore: https://www.hestore.hu/prod_10035561.html (3062 Ft) 
- **12V/5A+ tápegység** (pumpákhoz)
- **5V tápegység vagy USB** (ESP32, relay, szenzorok)
- **Csövek, csatlakozók**
  Szűkítők: https://www.aliexpress.com/item/1005008582765781.html?spm=a2g0o.detail.pcDetailBottomMoreOtherSeller.48.6a3b6e826e8254&gps-id=pcDetailBottomMoreOtherSeller&scm=1007.40050.354490.0&scm_id=1007.40050.354490.0&scm-url=1007.40050.354490.0&pvid=369644fe-10e4-41b1-8d89-e63028f0f822&_t=gps-id:pcDetailBottomMoreOtherSeller,scm-url:1007.40050.354490.0,pvid:369644fe-10e4-41b1-8d89-e63028f0f822,tpp_buckets:668%232846%238111%231996&pdp_ext_f=%7B%22order%22%3A%22308%22%2C%22eval%22%3A%221%22%2C%22sceneId%22%3A%2230050%22%2C%22fromPage%22%3A%22recommend%22%7D&pdp_npi=6%40dis%21USD%213.13%211.57%21%21%2122.17%2111.09%21%40211b813b17627987144042502e91ab%2112000045830417832%21rec%21HU%21704575041%21X%211%210%21n_tag%3A-29919%3Bd%3A81b1d44d%3Bm03_new_user%3A-29895&utparam-url=scene%3ApcDetailBottomMoreOtherSeller%7Cquery_from%3A%7Cx_object_id%3A1005008582765781%7C_p_origin_prod%3A

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
