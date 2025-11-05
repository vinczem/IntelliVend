# IntelliVend - Intelligens Italautomata Rendszer

![IntelliVend](frontend/icon-192.svg)

## 🍹 Bemutatkozás

Az IntelliVend egy IoT alapú italautomata rendszer, amely ESP32 mikrokontrollerrel, Node.js backenddel és modern webes kezelőfelülettel rendelkezik. A rendszer lehetővé teszi koktélok és italok automatizált elkészítését, készletkezelést, statisztikák vezetését és Home Assistant integrációt.

## ✨ Főbb Funkciók

- 🎯 **Recept kezelés**: Koktélok és italok receptjeinek létrehozása, módosítása
- 🔄 **Automatizált adagolás**: Több pumpa egyidejű vezérlése precíz mennyiségekkel
- 📊 **Készlet nyilvántartás**: Valós idejű követés, alacsony készlet riasztások
- 🌐 **Modern Web UI**: Reszponzív, érintőképernyő-barát kezelőfelület
- 📡 **MQTT kommunikáció**: ESP32 eszköz vezérlés MQTT protokollal
- 📈 **Statisztikák**: Részletes adagolási előzmények és elemzések
- 🔧 **Karbantartás**: Pumpa kalibráció és diagnosztika
- 🚨 **Email riasztások**: Automatikus értesítések alacsony készlet esetén
- 💾 **Backup/Restore**: Teljes adatbázis mentés és visszaállítás
- 🏠 **Home Assistant**: Teljes integráció add-on formájában

## 📦 Home Assistant Add-on

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

## 🏗️ Projekt Struktúra

```
IntelliVend/
├── backend/              # Node.js API szerver
│   ├── config/          # Konfigurációs fájlok
│   ├── routes/          # API végpontok
│   └── services/        # Szolgáltatások (email, stb.)
├── frontend/            # Web UI
│   ├── css/            # Stíluslapok
│   └── js/             # JavaScript modulok
├── database/            # SQL sémák és seed adatok
├── esp32/              # ESP32 firmware (PlatformIO)
├── homeassistant-addon/ # Home Assistant integráció
├── docker/             # Docker konfigurációk
└── tools/              # Fejlesztői eszközök
```

## 🚀 Gyors Kezdés

### Docker-rel (Ajánlott)

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

### Manuális Telepítés

#### Követelmények
- Node.js 18+ és npm
- MySQL 8.0+ vagy MariaDB 10.6+
- MQTT Broker (pl. Mosquitto)
- ESP32 fejlesztői környezet (PlatformIO)

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

#### ESP32 Firmware

```bash
cd esp32
cp config.h.sample config.h
# Szerkeszd a config.h fájlt
pio run -t upload
```

## 🔧 Konfiguráció

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
#define WIFI_SSID "your_wifi"
#define WIFI_PASSWORD "your_password"
#define MQTT_BROKER "192.168.1.100"
#define MQTT_PORT 1883
#define API_KEY "your_api_key"
```

## 📡 MQTT Topicok

### ESP32 → Backend
- `intellivend/status` - Eszköz állapot
- `intellivend/pump/flow` - Áramlásmérő adatok
- `intellivend/dispense/complete` - Adagolás befejezve
- `intellivend/error` - Hibaüzenetek

### Backend → ESP32
- `intellivend/dispense/start` - Adagolás indítása
- `intellivend/dispense/stop` - Adagolás leállítása
- `intellivend/pump/test` - Pumpa teszt
- `intellivend/calibrate` - Kalibráció

## 🛠️ Hardver

### Alkatrészlista
- ESP32 DevKit v1
- 12V perisztaltikus pumpák (1-16 db)
- Relay modul vagy MOSFET vezérlők
- Áramlásmérő szenzorok (opcionális)
- 12V/5A+ tápegység
- Csövek, csatlakozók

### Kapcsolási Rajz
TODO: Fritzing diagram hozzáadása

## 📚 API Dokumentáció

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
  -d '{"recipe_id":1,"quantity_ml":200}'
```

Teljes API dokumentáció: `docs/API.md` (TODO)

## 🧪 Fejlesztés

### Mock ESP32 használata

```bash
cd tools
python esp32_mock.py
```

Ez egy Python script, ami szimulál egy ESP32 eszközt teszteléshez.

### Tesztelés

```bash
cd backend
npm test
```

## 🤝 Hozzájárulás

A hozzájárulásokat szívesen fogadjuk! Kérjük:

1. Fork-old a repository-t
2. Hozz létre egy feature branch-et (`git checkout -b feature/amazing-feature`)
3. Commit-old a változtatásokat (`git commit -m 'Add amazing feature'`)
4. Push-old a branch-et (`git push origin feature/amazing-feature`)
5. Nyiss egy Pull Request-et

## 📝 Licensz

Ez a projekt MIT licensz alatt áll. Részletek a [LICENSE](LICENSE) fájlban.

## 👥 Fejlesztők

- **Zoltan Nagy** - Backend, ESP32 firmware
- **Mihály Vincze** - Frontend, integráció

## 🙏 Köszönetnyilvánítás

- Home Assistant közösség
- Minden nyílt forráskódú projekt, amit használtunk

## 📞 Támogatás

- **GitHub Issues**: https://github.com/vinczem/IntelliVend/issues
- **Email**: vinczem@github (replace @ with actual email)

---

⚠️ **Figyelmeztetés**: Az elektromos és mechanikai alkatrészek használata veszélyes lehet. Mindig bizonyosodj meg róla, hogy a berendezésed biztonságosan van felépítve. Az alkoholos italok fogyasztása saját felelősségre történik.

**Üzemeltetés során az adott ország törvényeinek betartása kötelező!**
