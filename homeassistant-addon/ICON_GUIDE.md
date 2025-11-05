# Home Assistant Add-on Ikonok

Ahhoz, hogy a Home Assistant Add-on Store-ban megfelelően jelenjen meg az IntelliVend, szükség van PNG formátumú ikonokra.

## Szükséges fájlok:

### 1. icon.png
- **Méret**: 256x256 pixel
- **Formátum**: PNG
- **Elérési út**: `homeassistant-addon/intellivend/icon.png`
- **Cél**: Add-on Store lista nézetben jelenik meg

### 2. logo.png
- **Méret**: 128x128 pixel  
- **Formátum**: PNG
- **Elérési út**: `homeassistant-addon/intellivend/logo.png`
- **Cél**: Add-on részletes nézetben jelenik meg

## Hogyan készítsd el:

### Online konverterek használata:

1. **Inkscape** vagy **Illustrator** használata:
   - Nyisd meg a `frontend/icon-192.svg` fájlt
   - Exportáld PNG-ként 256x256 méretben → `icon.png`
   - Exportáld PNG-ként 128x128 méretben → `logo.png`

2. **Online SVG → PNG konverter**:
   - https://cloudconvert.com/svg-to-png
   - https://convertio.co/svg-png/
   - Töltsd fel a `frontend/icon-192.svg` fájlt
   - Állítsd be a méretet (256x256 vagy 128x128)
   - Töltsd le és másold a megfelelő helyre

3. **ImageMagick CLI** (ha telepítve van):
   ```bash
   # icon.png (256x256)
   convert frontend/icon-192.svg -resize 256x256 homeassistant-addon/intellivend/icon.png
   
   # logo.png (128x128)
   convert frontend/icon-192.svg -resize 128x128 homeassistant-addon/intellivend/logo.png
   ```

4. **Node.js sharp csomag**:
   ```bash
   npm install -g sharp-cli
   sharp -i frontend/icon-192.svg -o homeassistant-addon/intellivend/icon.png resize 256 256
   sharp -i frontend/icon-192.svg -o homeassistant-addon/intellivend/logo.png resize 128 128
   ```

## Tervezési javaslatok:

- **Egyszerű és felismerhető**: Kis méretben is jól látható
- **Kontrasztos színek**: Világos és sötét témában is jól látszik
- **Átlátható háttér**: PNG alpha channel használata
- **Kerek sarkok**: Simább megjelenés (opcionális)
- **Ikonikus elem**: Használj egy koktélpoharat vagy csőrendszert

## Jelenlegi állapot:

A placeholder fájlok jelenleg szöveges fájlok. Cseréld le őket valódi PNG képekkel a fenti utasítások alapján.

## Commit után:

Miután létrehoztad a PNG fájlokat:

```bash
git add homeassistant-addon/intellivend/icon.png
git add homeassistant-addon/intellivend/logo.png
git commit -m "Add proper PNG icons for Home Assistant addon"
git push origin main
```
