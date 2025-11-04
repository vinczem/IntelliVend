# Docker Quick Start Guide - IntelliVend

## 📦 Mi van a dobozban?

A projekt 5 konténert használ:
- **backend** - Node.js API szerver (port 3000)
- **frontend** - Nginx webszerver (port 8080)
- **mysql** - MySQL adatbázis (port 3306)
- **phpmyadmin** - Webes DB kezelő (port 8081)
- **mosquitto** - MQTT broker ESP32-nek (port 1883, 9001)

---

## 🚀 Első használat

### 1. Docker telepítés
```bash
# Homebrew-val:
brew install --cask docker

# Vagy töltsd le: https://www.docker.com/products/docker-desktop
```

Indítsd el a Docker Desktop app-ot! (Kék bálna ikon)

### 2. Környezeti változók beállítása
```bash
cd docker
cp .env.example .env
nano .env  # vagy bármilyen szerkesztő
```

**Kötelező mezők:**
- `DB_PASSWORD` - Adatbázis jelszó (válassz egy biztonságosat!)
- `DB_USER` - Adatbázis felhasználó (pl. `intellivend_user`)
- `API_SECRET` - API titkosítási kulcs (random string)
- `ESP32_API_KEY` - ESP32 auth kulcs (random string)

**Opcionális:**
- Email beállítások (ha email értesítéseket akarsz)

### 3. Indítás
```bash
# Konténerek építése és indítása:
docker-compose up -d

# Naplók megtekintése:
docker-compose logs -f

# Csak egy szolgáltatás naplói:
docker-compose logs -f backend
```

**Mit jelent a `-d`?**  
Detached mode - háttérben fut, nem foglalja a terminált.

### 4. Ellenőrzés
```bash
# Futó konténerek:
docker-compose ps

# Egészségügyi állapot:
docker-compose ps | grep healthy
```

Nyisd meg a böngészőben:
- Frontend: http://localhost:8080
- API: http://localhost:3000
- phpMyAdmin: http://localhost:8081

---

## 🔧 Hasznos parancsok

### Alapműveletek
```bash
# Indítás (ha már meg vannak építve):
docker-compose up -d

# Leállítás (adatok megmaradnak):
docker-compose down

# Leállítás + volumek törlése (adatok TÖRLŐDNEK!):
docker-compose down -v

# Újraépítés (ha változott a kód):
docker-compose up -d --build

# Újraindítás (egy szolgáltatás):
docker-compose restart backend
```

### Debugging
```bash
# Belépés egy konténerbe:
docker-compose exec backend sh
docker-compose exec mysql mysql -u intellivend_user -p

# Naplók valós időben:
docker-compose logs -f --tail=100

# Erőforrás használat:
docker stats
```

### Adatbázis műveletek
```bash
# MySQL konzol:
docker-compose exec mysql mysql -u intellivend_user -p intellivend

# Backup készítése:
docker-compose exec mysql mysqldump -u intellivend_user -p intellivend > backup.sql

# Backup visszatöltése:
docker-compose exec -T mysql mysql -u intellivend_user -p intellivend < backup.sql
```

---

## 🧪 Tesztelés

### Backend API teszt:
```bash
# Health check:
curl http://localhost:3000/health

# Receptek listája:
curl http://localhost:3000/api/recipes
```

### Frontend teszt:
Nyisd meg: http://localhost:8080

### MQTT teszt (ha van ESP32):
```bash
# MQTT kliens telepítés:
brew install mosquitto

# Feliratkozás topic-ra:
mosquitto_sub -h localhost -p 1883 -t "intellivend/#" -v

# Teszt üzenet küldés:
mosquitto_pub -h localhost -p 1883 -t "intellivend/test" -m "Hello from Mac!"
```

---

## 🐛 Gyakori problémák

### 1. Port már foglalt
**Hiba:** `Error: port is already allocated`

**Megoldás:**
```bash
# Ellenőrizd mi használja:
lsof -i :3000
lsof -i :8080

# Állítsd le a másik folyamatot, vagy változtasd a portot:
nano docker-compose.yml
# Pl: "3001:3000" helyett "3000:3000"
```

### 2. Adatbázis connection refused
**Megoldás:**
```bash
# Várj amíg a MySQL egészséges lesz:
docker-compose logs mysql | grep "ready for connections"

# Ha nem indul el, töröld a volume-ot:
docker-compose down -v
docker-compose up -d
```

### 3. Hot reload nem működik
**Megoldás:**
A volume mount miatt a kód változtatások azonnal érvényesülnek.
Ha mégsem:
```bash
docker-compose restart backend
```

---

## 📊 Volume-ok (Adatmegőrzés)

A `mysql-data` volume tárolja az adatbázist. Ez **megmarad** még akkor is, ha:
- Leállítod a konténereket (`docker-compose down`)
- Újraindítod a gépet

**Törlés csak így:**
```bash
docker-compose down -v  # ⚠️ MINDEN adat törlődik!
```

---

## 🎓 Docker fogalmak gyorsan

- **Image** = Recept (pl: "Node.js 18 + npm telepítve")
- **Container** = Elkészített étel a receptből (futó instance)
- **Volume** = Külső merevlemez (adatok megmaradnak)
- **Network** = Belső hálózat (konténerek kommunikálhatnak)
- **Compose** = Karmester (több konténert egyszerre vezényel)

---

## 🏁 Következő lépések

1. ✅ Docker Desktop telepítve
2. ✅ `.env` fájl kitöltve
3. ✅ `docker-compose up -d` futtatva
4. ✅ http://localhost:8080 működik
5. 📝 Backup/Restore tesztelés
6. 📝 ESP32 MQTT teszt (ha elérhető)
7. 📝 HomeAssistant OS deployment előkészítés

---

**Gyors parancsok:**
```bash
# Állapot ellenőrzés:
docker-compose ps

# Minden leállítás:
docker-compose down

# Minden újraépítés:
docker-compose up -d --build

# Naplók:
docker-compose logs -f
```
