const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET inventory status
router.get('/', (req, res) => {
  const query = `
    SELECT inv.*, i.name as ingredient_name, i.type, p.pump_number,
           ROUND((inv.current_quantity / inv.bottle_size) * 100, 2) as fill_percentage,
           CASE 
             WHEN inv.current_quantity = 0 THEN 'empty'
             WHEN inv.current_quantity <= inv.min_quantity_alert THEN 'low'
             WHEN inv.current_quantity <= (inv.min_quantity_alert * 1.5) THEN 'warning'
             ELSE 'ok'
           END as status
    FROM inventory inv
    JOIN ingredients i ON inv.ingredient_id = i.id
    JOIN pumps p ON inv.pump_id = p.id
    ORDER BY p.pump_number ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(results);
  });
});

// PUT refill bottle
router.put('/refill/:pump_id', (req, res) => {
  const { bottle_size, quantity } = req.body;
  
  db.getConnection((err, connection) => {
    if (err) {
      return res.status(500).json({ error: 'Connection error', details: err.message });
    }

    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        return res.status(500).json({ error: 'Transaction error', details: err.message });
      }

      const updateInventoryQuery = `
        UPDATE inventory 
        SET initial_quantity = ?,
            current_quantity = ?,
            bottle_size = ?,
            refilled_at = CURRENT_TIMESTAMP
        WHERE pump_id = ?
      `;
      
      const refillQty = quantity || bottle_size;
      
      connection.query(updateInventoryQuery, [refillQty, refillQty, bottle_size, req.params.pump_id], (err, result) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: 'Database error', details: err.message });
          });
        }
        if (result.affectedRows === 0) {
          return connection.rollback(() => {
            connection.release();
            res.status(404).json({ error: 'Inventory record not found' });
          });
        }

        // Auto-resolve alerts for this pump
        const resolveAlertsQuery = `
          UPDATE alerts 
          SET is_resolved = 1, 
              resolved_at = CURRENT_TIMESTAMP 
          WHERE related_pump_id = ? 
            AND is_resolved = 0
            AND (type = 'low_stock' OR type = 'empty_bottle')
        `;

        connection.query(resolveAlertsQuery, [req.params.pump_id], (err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'Error resolving alerts', details: err.message });
            });
          }

          connection.commit(err => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: 'Commit error', details: err.message });
              });
            }
            connection.release();
            res.json({ message: 'Bottle refilled successfully' });
          });
        });
      });
    });
  });
});

// PUT update inventory settings (bottle_size, min_quantity_alert)
router.put('/settings/:pump_id', (req, res) => {
  const { bottle_size, min_quantity_alert } = req.body;
  
  if (!bottle_size || !min_quantity_alert) {
    return res.status(400).json({ error: 'bottle_size and min_quantity_alert are required' });
  }

  const query = `
    UPDATE inventory 
    SET bottle_size = ?,
        min_quantity_alert = ?
    WHERE pump_id = ?
  `;
  
  db.query(query, [bottle_size, min_quantity_alert, req.params.pump_id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }
    res.json({ message: 'Inventory settings updated successfully' });
  });
});

// PUT bulk refill (all pumps)
router.put('/refill-all', (req, res) => {
  db.getConnection((err, connection) => {
    if (err) {
      return res.status(500).json({ error: 'Connection error', details: err.message });
    }

    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        return res.status(500).json({ error: 'Transaction error', details: err.message });
      }

      // Update all inventory items
      const updateInventoryQuery = `
        UPDATE inventory 
        SET current_quantity = bottle_size,
            initial_quantity = bottle_size,
            refilled_at = CURRENT_TIMESTAMP
      `;
      
      connection.query(updateInventoryQuery, (err, result) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: 'Database error', details: err.message });
          });
        }

        // Resolve all low_stock and empty_bottle alerts
        const resolveAlertsQuery = `
          UPDATE alerts 
          SET is_resolved = 1, 
              resolved_at = CURRENT_TIMESTAMP 
          WHERE is_resolved = 0
            AND (type = 'low_stock' OR type = 'empty_bottle')
        `;

        connection.query(resolveAlertsQuery, (err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'Error resolving alerts', details: err.message });
            });
          }

          connection.commit(err => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: 'Commit error', details: err.message });
              });
            }
            connection.release();
            res.json({ 
              message: 'All bottles refilled successfully',
              refilled_count: result.affectedRows
            });
          });
        });
      });
    });
  });
});

module.exports = router;
