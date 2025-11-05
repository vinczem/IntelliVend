const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');

// MQTT will be injected from server.js
let mqttClient = null;

function setMqttClient(client) {
  mqttClient = client;
}

/**
 * @swagger
 * /api/maintenance/flush/{pump_id}:
 *   post:
 *     summary: Pumpa öblítése
 *     description: Egy pumpa öblítése vízzel megadott ideig
 *     tags: [Maintenance]
 *     parameters:
 *       - in: path
 *         name: pump_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A pumpa ID-ja
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               duration_ms:
 *                 type: integer
 *                 default: 5000
 *                 minimum: 1000
 *                 maximum: 30000
 *                 example: 5000
 *                 description: Öblítés időtartama milliszekundumban
 *               notes:
 *                 type: string
 *                 example: Tisztítás után
 *                 description: Jegyzetek
 *     responses:
 *       200:
 *         description: Öblítés sikeresen elindítva
 *       400:
 *         description: Érvénytelen paraméterek
 *       404:
 *         description: Pumpa nem található
 *       500:
 *         description: Szerver hiba
 */
/**
 * POST /api/maintenance/flush/:pump_id
 * Flush a single pump with water
 */
router.post('/flush/:pump_id', async (req, res) => {
  const pumpId = parseInt(req.params.pump_id);
  const { duration_ms = 5000, notes = '' } = req.body;

  // Validation
  if (isNaN(pumpId) || pumpId < 1) {
    return res.status(400).json({ error: 'Invalid pump ID' });
  }

  if (duration_ms < 1000 || duration_ms > 30000) {
    return res.status(400).json({ error: 'Duration must be between 1000-30000 ms (1-30 seconds)' });
  }

  try {
    // Check if pump exists
    const [pumps] = await db.promise().query('SELECT * FROM pumps WHERE id = ?', [pumpId]);
    
    if (pumps.length === 0) {
      return res.status(404).json({ error: 'Pump not found' });
    }

    const pump = pumps[0];

    // Log the maintenance action
    const insertQuery = `
      INSERT INTO maintenance_log (pump_id, action_type, duration_ms, notes)
      VALUES (?, 'flush', ?, ?)
    `;
    
    const [result] = await db.promise().query(insertQuery, [pumpId, duration_ms, notes]);

    // Send MQTT command to ESP32
    if (mqttClient && mqttClient.connected) {
      try {
        await mqttClient.commandFlush(pumpId, duration_ms);
        logger.info(`Flush command sent for pump ${pumpId} (${duration_ms}ms)`);
      } catch (err) {
        logger.error(`Failed to publish flush command for pump ${pumpId}:`, err);
      }
    } else {
      logger.warn('MQTT client not connected, flush command not sent to hardware');
    }

    res.json({
      success: true,
      message: `Flush started for pump ${pump.pump_number}`,
      log_id: result.insertId,
      pump_id: pumpId,
      duration_ms: duration_ms
    });

  } catch (error) {
    logger.error('Error during pump flush:', error);
    res.status(500).json({ error: 'Failed to flush pump' });
  }
});

/**
 * @swagger
 * /api/maintenance/flush-all:
 *   post:
 *     summary: Összes pumpa öblítése
 *     description: Az összes aktív pumpa öblítése egyszerre
 *     tags: [Maintenance]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               duration_ms:
 *                 type: integer
 *                 default: 5000
 *                 minimum: 1000
 *                 maximum: 30000
 *                 example: 5000
 *                 description: Öblítés időtartama milliszekundumban
 *               notes:
 *                 type: string
 *                 default: Bulk flush
 *                 description: Jegyzetek
 *     responses:
 *       200:
 *         description: Öblítés sikeresen elindítva
 *       400:
 *         description: Érvénytelen paraméterek
 *       404:
 *         description: Nincs aktív pumpa
 *       500:
 *         description: Szerver hiba
 */
/**
 * POST /api/maintenance/flush-all
 * Flush all active pumps sequentially
 */
router.post('/flush-all', async (req, res) => {
  const { duration_ms = 5000, notes = 'Bulk flush' } = req.body;

  if (duration_ms < 1000 || duration_ms > 30000) {
    return res.status(400).json({ error: 'Duration must be between 1000-30000 ms (1-30 seconds)' });
  }

  try {
    // Get all active pumps
    const [pumps] = await db.promise().query('SELECT * FROM pumps WHERE is_active = true ORDER BY pump_number');

    if (pumps.length === 0) {
      return res.status(404).json({ error: 'No active pumps found' });
    }

    const logIds = [];

    // Log maintenance for each pump
    for (const pump of pumps) {
      const insertQuery = `
        INSERT INTO maintenance_log (pump_id, action_type, duration_ms, notes)
        VALUES (?, 'flush', ?, ?)
      `;
      
      const [result] = await db.promise().query(insertQuery, [pump.id, duration_ms, notes]);
      logIds.push(result.insertId);
    }

    // Send MQTT command for all pumps at once (pump_id = -1)
    if (mqttClient && mqttClient.connected) {
      try {
        await mqttClient.commandFlush(-1, duration_ms);  // -1 = all pumps
        logger.info(`Bulk flush command sent for ${pumps.length} pumps (${duration_ms}ms)`);
      } catch (err) {
        logger.error('Failed to publish bulk flush command:', err);
      }
    } else {
      logger.warn('MQTT client not connected, bulk flush command not sent to hardware');
    }

    logger.info(`Bulk flush initiated for ${pumps.length} pumps (${duration_ms}ms each)`);

    res.json({
      success: true,
      message: `Flush started for ${pumps.length} pumps`,
      pumps_flushed: pumps.length,
      log_ids: logIds,
      duration_ms: duration_ms
    });

  } catch (error) {
    logger.error('Error during bulk flush:', error);
    res.status(500).json({ error: 'Failed to flush pumps' });
  }
});

/**
 * @swagger
 * /api/maintenance/history/{pump_id}:
 *   get:
 *     summary: Pumpa karbantartási előzmények
 *     description: Egy pumpa karbantartási előzményeinek lekérése
 *     tags: [Maintenance]
 *     parameters:
 *       - in: path
 *         name: pump_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A pumpa ID-ja
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Lekérendő rekordok maximális száma
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *       400:
 *         description: Érvénytelen pumpa ID
 *       500:
 *         description: Adatbázis hiba
 */
/**
 * GET /api/maintenance/history/:pump_id
 * Get maintenance history for a specific pump
 */
router.get('/history/:pump_id', async (req, res) => {
  const pumpId = parseInt(req.params.pump_id);
  const limit = parseInt(req.query.limit) || 50;

  if (isNaN(pumpId) || pumpId < 1) {
    return res.status(400).json({ error: 'Invalid pump ID' });
  }

  try {
    const query = `
      SELECT 
        ml.*,
        p.pump_number,
        i.name as ingredient_name
      FROM maintenance_log ml
      JOIN pumps p ON ml.pump_id = p.id
      LEFT JOIN ingredients i ON p.ingredient_id = i.id
      WHERE ml.pump_id = ?
      ORDER BY ml.performed_at DESC
      LIMIT ?
    `;

    const [logs] = await db.promise().query(query, [pumpId, limit]);

    res.json({
      success: true,
      pump_id: pumpId,
      count: logs.length,
      logs: logs
    });

  } catch (error) {
    logger.error('Error fetching maintenance history:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance history' });
  }
});

/**
 * GET /api/maintenance/history
 * Get maintenance history for all pumps
 */
router.get('/history', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const actionType = req.query.action_type; // filter by action type (optional)

  try {
    let query = `
      SELECT 
        ml.*,
        p.pump_number,
        i.name as ingredient_name
      FROM maintenance_log ml
      JOIN pumps p ON ml.pump_id = p.id
      LEFT JOIN ingredients i ON p.ingredient_id = i.id
      WHERE 1=1
    `;

    const params = [];

    if (actionType && ['flush', 'calibration', 'repair', 'other'].includes(actionType)) {
      query += ' AND ml.action_type = ?';
      params.push(actionType);
    }

    query += ' ORDER BY ml.performed_at DESC LIMIT ?';
    params.push(limit);

    const [logs] = await db.promise().query(query, params);

    res.json({
      success: true,
      count: logs.length,
      logs: logs
    });

  } catch (error) {
    logger.error('Error fetching maintenance history:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance history' });
  }
});

/**
 * GET /api/maintenance/stats
 * Get maintenance statistics (total flushes, last flush date, etc.)
 */
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_maintenance_actions,
        COUNT(CASE WHEN action_type = 'flush' THEN 1 END) as total_flushes,
        COUNT(CASE WHEN action_type = 'calibration' THEN 1 END) as total_calibrations,
        MAX(performed_at) as last_maintenance,
        AVG(CASE WHEN action_type = 'flush' THEN duration_ms END) as avg_flush_duration_ms
      FROM maintenance_log
    `;

    const pumpStatsQuery = `
      SELECT 
        p.id,
        p.pump_number,
        i.name as ingredient_name,
        COUNT(ml.id) as maintenance_count,
        MAX(ml.performed_at) as last_maintenance
      FROM pumps p
      LEFT JOIN maintenance_log ml ON p.id = ml.pump_id
      LEFT JOIN ingredients i ON p.ingredient_id = i.id
      WHERE p.is_active = true
      GROUP BY p.id, p.pump_number, i.name
      ORDER BY p.pump_number
    `;

    const [overallStats] = await db.promise().query(statsQuery);
    const [pumpStats] = await db.promise().query(pumpStatsQuery);

    res.json({
      success: true,
      overall: overallStats[0],
      by_pump: pumpStats
    });

  } catch (error) {
    logger.error('Error fetching maintenance stats:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance stats' });
  }
});

/**
 * POST /api/maintenance/test-dispense
 * Test endpoint to trigger mock ESP32 dispense for testing real-time progress bar
 */
router.post('/test-dispense', async (req, res) => {
  const { pump_id = 1, amount_ml = 50, recipe_name = 'Test Drink' } = req.body;

  if (!mqttClient) {
    return res.status(503).json({ error: 'MQTT not connected' });
  }

  try {
    const command = {
      pump_id,
      amount_ml,
      recipe_name
    };

    mqttClient.publish('intellivend/dispense/command', JSON.stringify(command), { qos: 1 });
    
    logger.info(`Test dispense command sent: Pump ${pump_id}, ${amount_ml}ml`);

    res.json({
      success: true,
      message: 'Test dispense started',
      command
    });

  } catch (error) {
    logger.error('Error sending test dispense command:', error);
    res.status(500).json({ error: 'Failed to send test dispense command' });
  }
});

module.exports = router;
module.exports.setMqttClient = setMqttClient;
