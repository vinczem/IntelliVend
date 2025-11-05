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

Az ESP32 a következő MQTT topicokat használja:

### Publikált topicok (ESP32 → Backend)
- `intellivend/status` - ESP32 állapot
- `intellivend/dispense/complete` - Adagolás befejezve
- `intellivend/maintenance/complete` - Öblítés befejezve
- `intellivend/error` - Hibaüzenetek
- `intellivend/heartbreak` - Életjel topic

### Feliratkozott topicok (Backend → ESP32)
- `intellivend/dispense/command` - Adagolás indítása
- `intellivend/maintenance/flush` - Öblítés indítása

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
