const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET statistics
router.get('/', (req, res) => {
  const stats = {};
  
  // Total drinks dispensed
  db.query('SELECT COUNT(*) as total FROM dispensing_log WHERE status = "completed"', (err, result) => {
    if (!err) stats.total_drinks = result[0].total;
    
    // Total volume dispensed
    db.query('SELECT SUM(total_volume_ml) as total_volume FROM dispensing_log WHERE status = "completed"', (err, result) => {
      if (!err) stats.total_volume_ml = result[0].total_volume || 0;
      
      // Most popular recipes
      db.query(`
        SELECT r.name, COUNT(dl.id) as count
        FROM dispensing_log dl
        JOIN recipes r ON dl.recipe_id = r.id
        WHERE dl.status = "completed"
        GROUP BY dl.recipe_id
        ORDER BY count DESC
        LIMIT 10
      `, (err, results) => {
        if (!err) stats.popular_recipes = results;
        
        // Inventory status summary
        db.query(`
          SELECT 
            COUNT(*) as total_items,
            SUM(CASE WHEN current_quantity <= min_quantity_alert THEN 1 ELSE 0 END) as low_stock_items,
            SUM(CASE WHEN current_quantity <= 0 THEN 1 ELSE 0 END) as empty_items
          FROM inventory
        `, (err, result) => {
          if (!err) stats.inventory = result[0];
          
          // Active alerts
          db.query('SELECT COUNT(*) as total FROM alerts WHERE is_resolved = 0', (err, result) => {
            if (!err) stats.active_alerts = result[0].total;
            
            res.json(stats);
          });
        });
      });
    });
  });
});

// GET daily statistics
router.get('/daily', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  
  const query = `
    SELECT 
      DATE(started_at) as date,
      COUNT(*) as drinks_count,
      SUM(total_volume_ml) as total_volume,
      COUNT(DISTINCT recipe_id) as unique_recipes
    FROM dispensing_log
    WHERE status = "completed" 
      AND started_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY DATE(started_at)
    ORDER BY date DESC
  `;
  
  db.query(query, [days], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(results);
  });
});

module.exports = router;
