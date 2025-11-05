# IntelliVend Home Assistant Add-on

![IntelliVend Logo](https://raw.githubusercontent.com/vinczem/IntelliVend/main/frontend/icon-192.svg)

## Intelligens Italautomata Rendszer

Az IntelliVend egy teljes körű italautomata rendszer Home Assistant-hez, amely lehetővé teszi koktélok és italok automatizált előkészítését ESP32 alapú hardverrel.

## Funkciók

- 🍹 **Recept kezelés**: Koktélok és italok receptjeinek létrehozása, szerkesztése
- 🔄 **Automatizált adagolás**: Precíz mennyiségű alapanyagok adagolása többpontos pumpákkal
- 📊 **Készlet nyilvántartás**: Valós idejű nyomon követés és alacsony készlet riasztások
- 🌐 **Modern Web UI**: Reszponzív, touch-friendly kezelőfelület
- 📡 **MQTT integráció**: ESP32 vezérlés MQTT protokollal
- 📈 **Statisztikák**: Részletes adagolási előzmények és fogyasztási adatok
- 🔧 **Karbantartás**: Pumpa kalibráció és diagnosztika
- 🚨 **Riasztások**: Email értesítések alacsony készlet esetén
- 💾 **Backup/Restore**: Teljes adatbázis mentés és visszaállítás

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

#### MySQL/MariaDB beállítása

Az IntelliVend MySQL/MariaDB adatbázist igényel. Ha még nincs telepítve:

1. Telepítsd a **MariaDB** add-ont a hivatalos repository-ból
2. Indítsd el és hozz létre egy adatbázist és felhasználót az IntelliVend számára

#### MQTT beállítása

Az ESP32 eszközzel való kommunikációhoz MQTT broker szükséges:

1. Telepítsd a **Mosquitto broker** add-ont
2. Konfiguráld a felhasználókat és jogosultságokat

#### IntelliVend konfiguráció

A Configuration lapon állítsd be a következőket:

```yaml
mysql_host: core-mariadb
mysql_port: 3306
mysql_database: intellivend
mysql_user: intellivend
mysql_password: your_secure_password
mqtt_broker: core-mosquitto
mqtt_port: 1883
mqtt_user: intellivend
mqtt_password: your_mqtt_password
log_level: info
```

### 4. Indítás

1. Kattints a **Start** gombra
2. Engedélyezd a **Start on boot** opciót
3. Ellenőrizd a logokat, hogy minden rendben elindult-e

### 5. Hozzáférés

Az add-on elérhető:
- **Ingress-en keresztül**: Kattints a **Open Web UI** gombra
- **Közvetlen elérés**: `http://homeassistant.local:8099`
- **API**: `http://homeassistant.local:3000/api`

## Első lépések

1. **ESP32 konfigurálása**: 
   - Használd az `/esp32/config.h.sample` fájlt sablonként
   - Állítsd be a WiFi és MQTT paramétereket
   - Töltsd fel a kódot az ESP32-re

2. **Alapanyagok felvitele**:
   - Navigálj az Ingredients (Alapanyagok) menüponthoz
   - Add hozzá az italautomatádban található alapanyagokat

3. **Pumpák beállítása**:
   - A Pumps (Pumpák) menüpontban rendeld hozzá az alapanyagokat a pumpákhoz
   - Állítsd be a GPIO pineket

4. **Készlet feltöltése**:
   - Az Inventory (Készlet) menüpontban rögzítsd a palackok méretét és mennyiségét

5. **Receptek létrehozása**:
   - A Recipes (Receptek) menüben hozz létre koktél recepteket
   - Állítsd be az alapanyagok mennyiségét

6. **Adagolás**:
   - A Dispense (Adagolás) menüpontból indítsd el az italok készítését

## Konfigurációs Opciók

### MySQL beállítások

- **mysql_host**: MySQL szerver címe (alapértelmezett: `core-mariadb`)
- **mysql_port**: MySQL port (alapértelmezett: `3306`)
- **mysql_database**: Adatbázis neve (alapértelmezett: `intellivend`)
- **mysql_user**: Adatbázis felhasználó
- **mysql_password**: Adatbázis jelszó (kötelező!)

### MQTT beállítások

- **mqtt_broker**: MQTT broker címe (alapértelmezett: `core-mosquitto`)
- **mqtt_port**: MQTT port (alapértelmezett: `1883`)
- **mqtt_user**: MQTT felhasználónév (opcionális)
- **mqtt_password**: MQTT jelszó (opcionális)

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

Az ESP32 a következő MQTT topicokat használja:

### Publikált topicok (ESP32 → Backend)
- `intellivend/status` - ESP32 állapot
- `intellivend/pump/flow` - Áramlásmérő adatok
- `intellivend/dispense/complete` - Adagolás befejezve
- `intellivend/error` - Hibaüzenetek

### Feliratkozott topicok (Backend → ESP32)
- `intellivend/dispense/start` - Adagolás indítása
- `intellivend/dispense/stop` - Adagolás leállítása
- `intellivend/pump/test` - Pumpa teszt
- `intellivend/calibrate` - Kalibráció

## Támogatás

- **GitHub Issues**: https://github.com/vinczem/IntelliVend/issues
- **Dokumentáció**: https://github.com/vinczem/IntelliVend
- **ESP32 Mock tool**: A repository tartalmaz egy mock eszközt teszteléshez

## Changelog

### 1.0.0 (2025-11-05)
- Kezdeti kiadás
- Teljes recept kezelés
- MQTT alapú ESP32 vezérlés
- Készlet nyilvántartás
- Statisztikák és riasztások
- Backup/Restore funkció

## Licenc

MIT License - részletek a LICENSE fájlban

## Köszönetnyilvánítás

Fejlesztette: Zoltan Nagy és Mihály Vincze

---

**Figyelem**: Ez egy közösségi projekt. Használat előtt győződj meg róla, hogy az elektromos és mechanikai komponensek biztonságosan vannak felszerelve. Az italok fogyasztása saját felelősségre történik.
