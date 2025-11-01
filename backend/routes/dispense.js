const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const mqttClient = require('../config/mqtt');

// Promise wrappers for database operations
function dbQueryPromise(query, params) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

function getConnectionPromise() {
  return new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) reject(err);
      else resolve(connection);
    });
  });
}

function beginTransactionPromise(connection) {
  return new Promise((resolve, reject) => {
    connection.beginTransaction((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function queryPromise(connection, query, params) {
  return new Promise((resolve, reject) => {
    connection.query(query, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

function commitPromise(connection) {
  return new Promise((resolve, reject) => {
    connection.commit((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function rollbackPromise(connection) {
  return new Promise((resolve, reject) => {
    connection.rollback(() => {
      resolve(); // Always resolve, rollback errors are not critical
    });
  });
}

// POST dispense a drink
router.post('/', async (req, res) => {
  const { recipe_id } = req.body;
  
  let connection;
  
  try {
    // Get recipe with ingredients
    const recipeQuery = `
      SELECT r.*, ri.ingredient_id, ri.quantity, ri.unit, ri.order_number,
             i.name as ingredient_name, p.id as pump_id, p.pump_number, p.gpio_pin,
             inv.current_quantity
      FROM recipes r
      JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      JOIN ingredients i ON ri.ingredient_id = i.id
      JOIN inventory inv ON i.id = inv.ingredient_id
      JOIN pumps p ON inv.pump_id = p.id
      WHERE r.id = ? AND r.is_active = 1 AND p.is_active = 1
      ORDER BY ri.order_number
    `;
    
    const ingredients = await dbQueryPromise(recipeQuery, [recipe_id]);
    
    if (ingredients.length === 0) {
      return res.status(404).json({ error: 'Recipe not found or not available' });
    }
    
    // Check if all ingredients are available
    const unavailable = ingredients.filter(ing => {
      const qtyInMl = convertToMl(parseFloat(ing.quantity), ing.unit);
      return parseFloat(ing.current_quantity) < qtyInMl;
    });
    
    if (unavailable.length > 0) {
      return res.status(400).json({
        error: 'Insufficient ingredients',
        unavailable: unavailable.map(i => i.ingredient_name)
      });
    }
    
    const recipe = ingredients[0];
    const totalVolume = ingredients.reduce((sum, ing) => sum + convertToMl(parseFloat(ing.quantity), ing.unit), 0);
    
    // Get connection from pool
    connection = await getConnectionPromise();
    
    // Start transaction
    await beginTransactionPromise(connection);
    
    try {
      // Create dispensing log
      const logResult = await queryPromise(connection,
        'INSERT INTO dispensing_log (recipe_id, recipe_name, total_volume_ml, status) VALUES (?, ?, ?, ?)',
        [recipe_id, recipe.name, totalVolume, 'started']
      );
      
      const logId = logResult.insertId;
      
      // Create dispensing details and update inventory
      for (const ing of ingredients) {
        const qtyInMl = convertToMl(parseFloat(ing.quantity), ing.unit);
        
        await queryPromise(connection,
          'INSERT INTO dispensing_details (log_id, pump_id, ingredient_id, ingredient_name, quantity_ml, order_number) VALUES (?, ?, ?, ?, ?, ?)',
          [logId, ing.pump_id, ing.ingredient_id, ing.ingredient_name, qtyInMl, ing.order_number]
        );
        
        await queryPromise(connection,
          'UPDATE inventory SET current_quantity = current_quantity - ? WHERE pump_id = ?',
          [qtyInMl, ing.pump_id]
        );
      }
      
      // Commit transaction
      await commitPromise(connection);
      connection.release();
      connection = null;
      
      logger.info(`Dispensing started: ${recipe.name} (Log ID: ${logId})`);
      
      // Prepare ESP32 commands
      const dispenseCommands = ingredients.map(ing => ({
        pump_number: ing.pump_number,
        gpio_pin: ing.gpio_pin,
        quantity_ml: convertToMl(parseFloat(ing.quantity), ing.unit),
        ingredient: ing.ingredient_name,
        order: ing.order_number
      }));
      
      // Send commands via MQTT to ESP32 (best-effort)
      if (mqttClient.isConnected()) {
        try {
          await mqttClient.commandDispense(logId, dispenseCommands);
          logger.info(`MQTT dispense command sent for log_id: ${logId}`);
        } catch (mqttError) {
          logger.error('Failed to send MQTT command:', mqttError);
        }
      } else {
        logger.warn('MQTT not connected, ESP32 should poll REST API');
      }
      
      res.json({
        message: 'Dispensing started',
        log_id: logId,
        recipe_name: recipe.name,
        total_volume_ml: totalVolume,
        commands: dispenseCommands
      });
      
      // Check for low stock after dispensing (non-blocking)
      setImmediate(() => checkLowStock(ingredients));
      
    } catch (error) {
      if (connection) {
        await rollbackPromise(connection);
        connection.release();
        connection = null;
      }
      throw error;
    }
    
  } catch (error) {
    if (connection) {
      connection.release();
    }
    logger.error('Dispense error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// PUT update dispensing status (called by ESP32)
router.put('/status/:log_id', (req, res) => {
  const { status, error_message } = req.body;
  
  const query = `
    UPDATE dispensing_log 
    SET status = ?, 
        error_message = ?,
        completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
        duration_seconds = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP) ELSE duration_seconds END
    WHERE id = ?
  `;
  
  db.query(query, [status, error_message, status, status, req.params.log_id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dispensing log not found' });
    }
    
    logger.info(`Dispensing ${status}: Log ID ${req.params.log_id}`);
    res.json({ message: 'Status updated successfully' });
  });
});

// GET dispensing history
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  
  const query = `
    SELECT dl.*, 
           (SELECT GROUP_CONCAT(dd.ingredient_name ORDER BY dd.order_number SEPARATOR ', ')
            FROM dispensing_details dd WHERE dd.log_id = dl.id) as ingredients
    FROM dispensing_log dl
    ORDER BY dl.started_at DESC
    LIMIT ?
  `;
  
  db.query(query, [limit], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(results);
  });
});

// Helper functions
function convertToMl(quantity, unit) {
  switch (unit) {
    case 'cl': return quantity * 10;
    case 'l': return quantity * 1000;
    case 'ml':
    default: return quantity;
  }
}

// Note: per-route transaction now uses a dedicated connection; keep this utility for non-transactional queries if needed
function dbQuery(query, params) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

function checkLowStock(ingredients) {
  ingredients.forEach(ing => {
    const checkQuery = `
      SELECT inv.current_quantity, inv.min_quantity_alert, i.name, p.pump_number
      FROM inventory inv
      JOIN ingredients i ON inv.ingredient_id = i.id
      JOIN pumps p ON inv.pump_id = p.id
      WHERE inv.pump_id = ?
    `;
    
    db.query(checkQuery, [ing.pump_id], (err, results) => {
      if (err || results.length === 0) return;
      
      const inv = results[0];
      const currentQty = parseFloat(inv.current_quantity);
      const minAlert = parseFloat(inv.min_quantity_alert);
      
      if (currentQty <= minAlert) {
        const newSeverity = currentQty <= 0 ? 'critical' : 'warning';
        const newType = currentQty <= 0 ? 'empty_bottle' : 'low_stock';
        const message = `A(z) ${inv.name} (${inv.pump_number}. pumpa) szintje ${currentQty <= 0 ? 'üres' : 'alacsony'} (${currentQty} ml maradt)`;
        
        // Check if there's already an unresolved alert for this pump+ingredient
        const existingAlertQuery = `
          SELECT id, severity FROM alerts
          WHERE related_pump_id = ? 
            AND related_ingredient_id = ?
            AND is_resolved = 0
          LIMIT 1
        `;
        
        db.query(existingAlertQuery, [ing.pump_id, ing.ingredient_id], (err, existingAlerts) => {
          if (err) {
            logger.error('Error checking existing alerts:', err);
            return;
          }
          
          if (existingAlerts.length > 0) {
            // Update the first alert and resolve any other duplicates
            const alertToUpdate = existingAlerts[0];
            const updateQuery = `
              UPDATE alerts 
              SET type = ?,
                  severity = ?,
                  message = ?,
                  created_at = NOW()
              WHERE id = ?
            `;
            
            db.query(updateQuery, [newType, newSeverity, message, alertToUpdate.id], (err) => {
              if (!err) {
                if (alertToUpdate.severity !== newSeverity) {
                  logger.warn(`Alert severity escalated: ${message}`);
                } else {
                  logger.info(`Alert updated: ${message}`);
                }
                
                // Resolve any duplicate alerts for the same pump+ingredient
                if (existingAlerts.length > 1) {
                  const duplicateIds = existingAlerts.slice(1).map(a => a.id);
                  const resolveDuplicatesQuery = `
                    UPDATE alerts 
                    SET is_resolved = 1, 
                        resolved_at = NOW()
                    WHERE id IN (?)
                  `;
                  
                  db.query(resolveDuplicatesQuery, [duplicateIds], (err) => {
                    if (!err) {
                      logger.info(`Resolved ${duplicateIds.length} duplicate alert(s) for pump ${ing.pump_id}`);
                    }
                  });
                }
              }
            });
          } else {
            // Create new alert
            const insertQuery = `
              INSERT INTO alerts (type, severity, message, related_pump_id, related_ingredient_id)
              VALUES (?, ?, ?, ?, ?)
            `;
            
            db.query(insertQuery, [newType, newSeverity, message, ing.pump_id, ing.ingredient_id], (err) => {
              if (!err) {
                logger.warn(`New alert created: ${message}`);
              }
            });
          }
        });
      }
    });
  });
}

module.exports = router;
