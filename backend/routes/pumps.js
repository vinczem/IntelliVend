const express = require('express');
const router = express.Router();
const db = require('../config/database');

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

// PUT assign ingredient to pump
router.put('/:id/assign', (req, res) => {
  const { ingredient_id, bottle_size, initial_quantity, gpio_pin, flow_meter_pin, notes } = req.body;

  db.getConnection((connErr, conn) => {
    if (connErr) {
      return res.status(500).json({ error: 'Database connection error', details: connErr.message });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).json({ error: 'Transaction error', details: txErr.message });
      }

      // Update pump with all fields
      const updatePumpQuery = `
        UPDATE pumps 
        SET ingredient_id = ?, 
            gpio_pin = ?, 
            flow_meter_pin = ?, 
            notes = ? 
        WHERE id = ?
      `;
      
      conn.query(updatePumpQuery, [ingredient_id, gpio_pin, flow_meter_pin, notes, req.params.id], (err) => {
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
