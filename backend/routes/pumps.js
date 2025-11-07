const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * @swagger
 * /api/pumps:
 *   get:
 *     summary: Összes pumpa lekérése
 *     description: Visszaadja az összes pumpát a hozzárendelt alapanyagokkal és készletadatokkal
 *     tags: [Pumps]
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Pump'
 *       500:
 *         description: Adatbázis hiba
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET all pumps with their assigned ingredients
router.get('/', (req, res) => {
  const query = `
    SELECT p.*, i.name as ingredient_name, i.type as ingredient_type,
           inv.current_quantity, inv.bottle_size, inv.min_quantity_alert
    FROM pumps p
    LEFT JOIN ingredients i ON p.ingredient_id = i.id
    LEFT JOIN inventory inv ON p.id = inv.pump_id
    ORDER BY p.pump_number
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(results);
  });
});

/**
 * @swagger
 * /api/pumps/{id}:
 *   get:
 *     summary: Egy pumpa lekérése ID alapján
 *     description: Visszaad egy konkrét pumpát az alapanyag és készletadatokkal
 *     tags: [Pumps]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A pumpa ID-ja
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pump'
 *       404:
 *         description: Pumpa nem található
 *       500:
 *         description: Adatbázis hiba
 */
// GET pump by ID
router.get('/:id', (req, res) => {
  const query = `
    SELECT p.*, i.name as ingredient_name, i.type as ingredient_type,
           inv.current_quantity, inv.bottle_size
    FROM pumps p
    LEFT JOIN ingredients i ON p.ingredient_id = i.id
    LEFT JOIN inventory inv ON p.id = inv.pump_id
    WHERE p.id = ?
  `;
  
  db.query(query, [req.params.id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Pump not found' });
    }
    res.json(results[0]);
  });
});

/**
 * @swagger
 * /api/pumps/{id}/assign:
 *   put:
 *     summary: Alapanyag hozzárendelése pumpához
 *     description: Alapanyag hozzárendelése egy pumpához és a kezdeti készlet beállítása
 *     tags: [Pumps]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A pumpa ID-ja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ingredient_id
 *               - bottle_size
 *               - initial_quantity
 *             properties:
 *               ingredient_id:
 *                 type: integer
 *                 example: 1
 *                 description: Az alapanyag ID-ja
 *               bottle_size:
 *                 type: integer
 *                 example: 1000
 *                 description: Palack mérete ml-ben
 *               initial_quantity:
 *                 type: integer
 *                 example: 1000
 *                 description: Kezdeti mennyiség ml-ben
 *               notes:
 *                 type: string
 *                 example: Bal oldali pumpa
 *                 description: Jegyzetek
 *     responses:
 *       200:
 *         description: Pumpa sikeresen hozzárendelve
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Adatbázis hiba
 */
// PUT assign ingredient to pump
router.put('/:id/assign', (req, res) => {
  const { ingredient_id, bottle_size, initial_quantity, notes } = req.body;

  db.getConnection((connErr, conn) => {
    if (connErr) {
      return res.status(500).json({ error: 'Database connection error', details: connErr.message });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).json({ error: 'Transaction error', details: txErr.message });
      }

      // Update pump (GPIO pins managed by ESP32, not backend)
      const updatePumpQuery = `
        UPDATE pumps 
        SET ingredient_id = ?, 
            notes = ? 
        WHERE id = ?
      `;
      
      conn.query(updatePumpQuery, [ingredient_id, notes, req.params.id], (err) => {
        if (err) {
          return conn.rollback(() => {
            conn.release();
            res.status(500).json({ error: 'Database error', details: err.message });
          });
        }

        // Delete old inventory entries for this pump
        const deleteInventoryQuery = 'DELETE FROM inventory WHERE pump_id = ?';
        conn.query(deleteInventoryQuery, [req.params.id], (delErr) => {
          if (delErr) {
            return conn.rollback(() => {
              conn.release();
              res.status(500).json({ error: 'Database error', details: delErr.message });
            });
          }

          // Insert new inventory
          const inventoryQuery = `
            INSERT INTO inventory (pump_id, ingredient_id, initial_quantity, current_quantity, bottle_size)
            VALUES (?, ?, ?, ?, ?)
          `;

          conn.query(inventoryQuery, [req.params.id, ingredient_id, initial_quantity, initial_quantity, bottle_size], (invErr) => {
            if (invErr) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({ error: 'Database error', details: invErr.message });
              });
            }

            conn.commit((commitErr) => {
              if (commitErr) {
                return conn.rollback(() => {
                  conn.release();
                  res.status(500).json({ error: 'Commit error', details: commitErr.message });
                });
              }
              conn.release();
              res.json({ message: 'Pump assigned successfully' });
            });
          });
        });
      });
    });
  });
});

/**
 * @swagger
 * /api/pumps/{id}/calibrate:
 *   put:
 *     summary: Pumpa kalibrálása
 *     description: Pumpa kalibrációs faktorának beállítása a pontos adagoláshoz
 *     tags: [Pumps]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A pumpa ID-ja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - calibration_factor
 *             properties:
 *               calibration_factor:
 *                 type: number
 *                 format: float
 *                 example: 1.05
 *                 description: Kalibrációs faktor (ml/másodperc)
 *     responses:
 *       200:
 *         description: Pumpa sikeresen kalibrálva
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Pumpa nem található
 *       500:
 *         description: Adatbázis hiba
 */
// PUT update pump calibration
router.put('/:id/calibrate', (req, res) => {
  const { calibration_factor } = req.body;
  const query = 'UPDATE pumps SET calibration_factor = ? WHERE id = ?';
  
  db.query(query, [calibration_factor, req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pump not found' });
    }
    res.json({ message: 'Pump calibrated successfully' });
  });
});

module.exports = router;
