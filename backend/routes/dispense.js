const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const mqttClient = require('../config/mqtt');
const emailService = require('../services/emailService');

// Lazy load HA service
let haService = null;
const getHAService = () => {
  if (!haService) {
    try {
      haService = require('../services/homeassistantService');
    } catch (e) {
      // Service not available
    }
  }
  return haService;
};

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

/**
 * @swagger
 * /api/dispense:
 *   post:
 *     summary: Ital adagolása
 *     description: Ital elkészítése és adagolása a recept alapján MQTT üzenetekkel
 *     tags: [Dispense]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipe_id
 *             properties:
 *               recipe_id:
 *                 type: integer
 *                 example: 1
 *                 description: A recept ID-ja
 *               strength:
 *                 type: string
 *                 enum: [weak, normal, strong]
 *                 default: normal
 *                 example: normal
 *                 description: Ital erőssége (gyenge/normál/erős)
 *     responses:
 *       200:
 *         description: Adagolás sikeresen elindítva
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 log_id:
 *                   type: integer
 *                 message:
 *                   type: string
 *                 recipe_name:
 *                   type: string
 *                 steps:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Hiányzó vagy inkompatibilis alapanyag
 *       404:
 *         description: Recept nem található
 *       500:
 *         description: Szerver hiba
 */
// POST dispense a drink
router.post('/', async (req, res) => {
  const { recipe_id, strength = 'normal' } = req.body; // strength: weak, normal, strong
  
  let connection;
  
  try {
    // Validate strength parameter
    const validStrengths = ['weak', 'normal', 'strong'];
    if (!validStrengths.includes(strength)) {
      return res.status(400).json({ error: 'Invalid strength parameter. Must be: weak, normal, or strong' });
    }
    
    // Strength multipliers for alcoholic ingredients
    const strengthMultipliers = {
      weak: 0.75,
      normal: 1.0,
      strong: 1.25
    };
    const alcoholMultiplier = strengthMultipliers[strength];
    
    // Get recipe with ingredients
    const recipeQuery = `
      SELECT r.*, ri.ingredient_id, ri.quantity, ri.unit, ri.order_number,
             i.name as ingredient_name, i.alcohol_percentage, p.id as pump_id, p.pump_number, p.gpio_pin,
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
    
    // Calculate adjusted quantities based on strength
    // Goal: Keep total volume constant, maintain ratios between non-alcoholic ingredients
    
    // First, calculate original totals
    const originalTotal = ingredients.reduce((sum, ing) => sum + parseFloat(ing.quantity), 0);
    const alcoholicTotal = ingredients
      .filter(ing => parseFloat(ing.alcohol_percentage) > 0)
      .reduce((sum, ing) => sum + parseFloat(ing.quantity), 0);
    const nonAlcoholicTotal = originalTotal - alcoholicTotal;
    
    // Calculate new alcoholic total after strength adjustment
    const newAlcoholicTotal = alcoholicTotal * alcoholMultiplier;
    
    // Remaining volume for non-alcoholic ingredients (to maintain total volume)
    const newNonAlcoholicTotal = originalTotal - newAlcoholicTotal;
    
    // Scale factor for non-alcoholic ingredients (to maintain their ratios)
    const nonAlcoholicScale = nonAlcoholicTotal > 0 ? newNonAlcoholicTotal / nonAlcoholicTotal : 1;
    
    const adjustedIngredients = ingredients.map(ing => {
      const isAlcoholic = parseFloat(ing.alcohol_percentage) > 0;
      
      if (isAlcoholic) {
        // Alcoholic ingredients get multiplied by strength
        return {
          ...ing,
          quantity: parseFloat(ing.quantity) * alcoholMultiplier
        };
      } else {
        // Non-alcoholic ingredients scaled to fill remaining volume while maintaining ratios
        return {
          ...ing,
          quantity: parseFloat(ing.quantity) * nonAlcoholicScale
        };
      }
    });    
    
    // Check if all ingredients are available (with adjusted quantities)
    const unavailable = adjustedIngredients.filter(ing => {
      const qtyInMl = convertToMl(ing.quantity, ing.unit);
      return parseFloat(ing.current_quantity) < qtyInMl;
    });
    
    if (unavailable.length > 0) {
      return res.status(400).json({
        error: 'Insufficient ingredients',
        unavailable: unavailable.map(i => i.ingredient_name)
      });
    }
    
    const recipe = adjustedIngredients[0];
    const totalVolume = adjustedIngredients.reduce((sum, ing) => sum + convertToMl(ing.quantity, ing.unit), 0);
    
        // Get connection from pool
    connection = await getConnectionPromise();
    
    // Start transaction
    await beginTransactionPromise(connection);
    
    try {
      // Create dispensing log with strength information
      const strengthNote = strength !== 'normal' ? `Strength: ${strength}` : null;
      const logResult = await queryPromise(connection,
        'INSERT INTO dispensing_log (recipe_id, recipe_name, total_volume_ml, status, notes) VALUES (?, ?, ?, ?, ?)',
        [recipe_id, recipe.name, totalVolume, 'started', strengthNote]
      );
      
      const logId = logResult.insertId;
      
      // Create dispensing details and update inventory (use adjusted quantities)
      for (const ing of adjustedIngredients) {
        const qtyInMl = convertToMl(ing.quantity, ing.unit);
        
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
      
      logger.info(`Dispensing started: ${recipe.name} (Log ID: ${logId}, Strength: ${strength})`);
      
      // Prepare ESP32 commands (use adjusted quantities)
      const dispenseCommands = adjustedIngredients.map(ing => ({
        pump_number: ing.pump_number,
        gpio_pin: ing.gpio_pin,
        quantity_ml: convertToMl(ing.quantity, ing.unit),
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
      
      // Update Home Assistant pump sensors (non-blocking)
      setImmediate(async () => {
        const ha = getHAService();
        if (ha) {
          try {
            // Update affected pumps
            for (const ing of adjustedIngredients) {
              const pumpData = await dbQueryPromise(`
                SELECT p.id as pump_id, inv.current_quantity, inv.bottle_size, inv.min_quantity_alert,
                       i.name as ingredient_name, i.alcohol_percentage > 0 as is_alcoholic
                FROM pumps p
                LEFT JOIN inventory inv ON p.id = inv.pump_id
                LEFT JOIN ingredients i ON p.ingredient_id = i.id
                WHERE p.id = ?
              `, [ing.pump_id]);
              
              if (pumpData.length > 0) {
                await ha.updatePumpStatus(ing.pump_id, pumpData[0]);
              }
            }
            
            // Update system alerts
            const allPumps = await dbQueryPromise(`
              SELECT p.id as pump_id, inv.current_quantity, inv.bottle_size, inv.min_quantity_alert,
                     i.name as ingredient_name, i.alcohol_percentage > 0 as is_alcoholic
              FROM pumps p
              LEFT JOIN inventory inv ON p.id = inv.pump_id
              LEFT JOIN ingredients i ON p.ingredient_id = i.id
            `);
            await ha.updateSystemAlerts(allPumps);
          } catch (err) {
            logger.error('Error updating HA sensors after dispense:', err);
          }
        }
      });
      
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

/**
 * @swagger
 * /api/dispense/status/{log_id}:
 *   put:
 *     summary: Adagolási státusz frissítése
 *     description: ESP32 által hívott endpoint az adagolás állapotának frissítéséhez
 *     tags: [Dispense]
 *     parameters:
 *       - in: path
 *         name: log_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A dispensing log ID-ja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, dispensing, completed, failed, cancelled]
 *                 example: completed
 *               error_message:
 *                 type: string
 *                 example: Pump 3 timeout
 *     responses:
 *       200:
 *         description: Státusz sikeresen frissítve
 *       404:
 *         description: Dispensing log nem található
 *       500:
 *         description: Adatbázis hiba
 */
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
    
    // Update Home Assistant last dispense sensor on completion
    if (status === 'completed') {
      const ha = getHAService();
      if (ha) {
        db.query(`
          SELECT recipe_name, started_at, duration_seconds, total_volume_ml
          FROM dispensing_log
          WHERE id = ?
        `, [req.params.log_id], async (err, results) => {
          if (!err && results.length > 0) {
            await ha.updateLastDispense(results[0]);
          }
        });
      }
    }
    
    res.json({ message: 'Status updated successfully' });
  });
});

/**
 * @swagger
 * /api/dispense/history:
 *   get:
 *     summary: Adagolási előzmények lekérése
 *     description: Legutóbbi adagolások listája részletekkel
 *     tags: [Dispense]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Lekérendő rekordok maximális száma
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   recipe_id:
 *                     type: integer
 *                   recipe_name:
 *                     type: string
 *                   status:
 *                     type: string
 *                   started_at:
 *                     type: string
 *                     format: date-time
 *                   completed_at:
 *                     type: string
 *                     format: date-time
 *                   duration_seconds:
 *                     type: integer
 *                   total_volume_ml:
 *                     type: number
 *                   ingredients:
 *                     type: string
 *       500:
 *         description: Adatbázis hiba
 */
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
                const severityEscalated = alertToUpdate.severity !== newSeverity;
                
                if (severityEscalated) {
                  logger.warn(`Alert severity escalated: ${message}`);
                  
                  // Send email on severity escalation (warning → critical)
                  // IMPORTANT: Skip throttling for escalations - always send!
                  if (newSeverity === 'critical') {
                    sendAlertEmail({
                      id: alertToUpdate.id,
                      message: message,
                      severity: newSeverity,
                      type: newType,
                      ingredient_name: inv.name,
                      pump_number: inv.pump_number,
                      created_at: new Date()
                    }, true); // skipThrottling = true for escalations
                  }
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
            
            db.query(insertQuery, [newType, newSeverity, message, ing.pump_id, ing.ingredient_id], (err, result) => {
              if (!err) {
                logger.warn(`New alert created: ${message}`);
                
                // Send email for new alert
                sendAlertEmail({
                  id: result.insertId,
                  message: message,
                  severity: newSeverity,
                  type: newType,
                  ingredient_name: inv.name,
                  pump_number: inv.pump_number,
                  created_at: new Date()
                });
              }
            });
          }
        });
      }
    });
  });
}

// Send alert email helper function
async function sendAlertEmail(alert, skipThrottling = false) {
  try {
    // Check if we already sent an email for this alert recently (within last hour)
    // BUT skip this check for severity escalations (they are always important!)
    if (!skipThrottling) {
      const checkQuery = `
        SELECT id FROM email_notifications
        WHERE alert_id = ?
          AND sent_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        LIMIT 1
      `;
      
      const throttleCheck = await new Promise((resolve, reject) => {
        db.query(checkQuery, [alert.id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      
      if (throttleCheck.length > 0) {
        logger.info(`Email already sent for alert ${alert.id} within last hour, skipping`);
        return;
      }
    } else {
      logger.info(`Skipping throttle check for alert ${alert.id} (severity escalation)`);
    }
    
    // Send appropriate email based on type
    let emailResult;
    if (alert.type === 'empty_bottle') {
      emailResult = await emailService.sendEmptyBottleAlert(alert);
    } else {
      emailResult = await emailService.sendLowStockAlert(alert);
    }
    
    // Log the email notification
    const insertQuery = `
      INSERT INTO email_notifications (alert_id, email_type, recipient_email, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const emailType = alert.type === 'empty_bottle' ? 'empty_bottle' : 'low_stock';
    const status = emailResult.success ? 'sent' : 'failed';
    const errorMessage = emailResult.success ? null : emailResult.error;
    
    db.query(insertQuery, [
      alert.id,
      emailType,
      process.env.ALERT_EMAIL,
      status,
      errorMessage
    ], (err) => {
      if (err) {
        logger.error('Error logging email notification:', err);
      }
    });
    
  } catch (error) {
    logger.error('Error sending alert email:', error);
  }
}

// POST report dispense timeout (when ESP32 doesn't respond)
router.post('/timeout/:log_id', async (req, res) => {
  const { log_id } = req.params;
  
  try {
    // Update dispensing log status to failed
    await dbQueryPromise(
      'UPDATE dispensing_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['failed', 'ESP32 timeout - no response within 60 seconds', log_id]
    );
    
    // Get recipe name for alert
    const logInfo = await dbQueryPromise(
      'SELECT recipe_name FROM dispensing_log WHERE id = ?',
      [log_id]
    );
    
    const recipeName = logInfo.length > 0 ? logInfo[0].recipe_name : 'Unknown';
    
    // Create alert
    const alertResult = await dbQueryPromise(
      `INSERT INTO alerts (type, severity, message, is_resolved) 
       VALUES (?, ?, ?, ?)`,
      [
        'system_error',
        'critical',
        `ESP32 nem válaszol! Adagolás megszakítva: ${recipeName} (Log ID: ${log_id})`,
        0
      ]
    );
    
    logger.warn(`ESP32 timeout reported for log_id: ${log_id}`);
    
    // Send email notification (non-blocking)
    setImmediate(async () => {
      try {
        const alert = {
          id: alertResult.insertId,
          type: 'system_error',
          severity: 'critical',
          message: `ESP32 nem válaszol! Adagolás megszakítva: ${recipeName} (Log ID: ${log_id})`,
          created_at: new Date()
        };
        
        const emailResult = await emailService.sendSystemErrorAlert(alert);
        
        // Log email notification
        const status = emailResult.success ? 'sent' : 'failed';
        const errorMessage = emailResult.success ? null : emailResult.error;
        
        await dbQueryPromise(
          `INSERT INTO email_notifications (alert_id, email_type, recipient_email, status, error_message)
           VALUES (?, ?, ?, ?, ?)`,
          [alert.id, 'system_error', process.env.ALERT_EMAIL, status, errorMessage]
        );
        
      } catch (emailError) {
        logger.error('Error sending timeout alert email:', emailError);
      }
    });
    
    res.json({ 
      message: 'Timeout reported and alert created',
      alert_id: alertResult.insertId 
    });
    
  } catch (error) {
    logger.error('Error reporting timeout:', error);
    res.status(500).json({ error: 'Failed to report timeout', details: error.message });
  }
});

module.exports = router;
