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

// GET cost analytics
router.get('/costs', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const stats = {};
  
  // Build date filter based on days parameter
  const dateFilter = days === 1
    ? 'DATE(dl.started_at) = CURDATE()'
    : 'dl.started_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
  
  // Calculate total costs for completed drinks
  const costQuery = `
    SELECT 
      SUM(
        (SELECT SUM(
          CASE 
            WHEN ri.unit = 'cl' THEN ri.quantity * 10 * ing.cost_per_unit
            WHEN ri.unit = 'l' THEN ri.quantity * 1000 * ing.cost_per_unit
            ELSE ri.quantity * ing.cost_per_unit
          END
        )
         FROM recipe_ingredients ri
         JOIN ingredients ing ON ri.ingredient_id = ing.id
         WHERE ri.recipe_id = dl.recipe_id)
      ) as total_cost,
      COUNT(*) as drinks_count
    FROM dispensing_log dl
    WHERE dl.status = "completed"
      AND ${dateFilter}
  `;
  
  const queryParams = days === 1 ? [] : [days];
  
  db.query(costQuery, queryParams, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    stats.total_cost = parseFloat(result[0].total_cost || 0);
    stats.drinks_count = result[0].drinks_count;
    stats.average_cost = stats.drinks_count > 0 ? stats.total_cost / stats.drinks_count : 0;
    
    // Today's costs
    const todayCostQuery = `
      SELECT 
        SUM(
          (SELECT SUM(
            CASE 
              WHEN ri.unit = 'cl' THEN ri.quantity * 10 * ing.cost_per_unit
              WHEN ri.unit = 'l' THEN ri.quantity * 1000 * ing.cost_per_unit
              ELSE ri.quantity * ing.cost_per_unit
            END
          )
           FROM recipe_ingredients ri
           JOIN ingredients ing ON ri.ingredient_id = ing.id
           WHERE ri.recipe_id = dl.recipe_id)
        ) as today_cost
      FROM dispensing_log dl
      WHERE dl.status = "completed"
        AND DATE(dl.started_at) = CURDATE()
    `;
    
    db.query(todayCostQuery, (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      
      stats.today_cost = parseFloat(result[0].today_cost || 0);
      
      // Top 5 most expensive recipes (actually dispensed in the period)
      const expensiveDateFilter = days === 1
        ? 'DATE(dl.started_at) = CURDATE()'
        : 'dl.started_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
      
      const expensiveQuery = `
        SELECT 
          r.id,
          r.name,
          SUM(
            CASE 
              WHEN ri.unit = 'cl' THEN ri.quantity * 10 * ing.cost_per_unit
              WHEN ri.unit = 'l' THEN ri.quantity * 1000 * ing.cost_per_unit
              ELSE ri.quantity * ing.cost_per_unit
            END
          ) as recipe_cost,
          COUNT(dl.id) as times_dispensed
        FROM dispensing_log dl
        JOIN recipes r ON dl.recipe_id = r.id
        JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        JOIN ingredients ing ON ri.ingredient_id = ing.id
        WHERE dl.status = "completed"
          AND ${expensiveDateFilter}
        GROUP BY r.id, r.name
        ORDER BY recipe_cost DESC
        LIMIT 5
      `;
      
      db.query(expensiveQuery, queryParams, (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Database error', details: err.message });
        }
        
        stats.expensive_recipes = results.map(r => ({
          id: r.id,
          name: r.name,
          cost: parseFloat(r.recipe_cost || 0),
          times_dispensed: r.times_dispensed
        }));
        
        // Cost breakdown by ingredient
        const breakdownDateFilter = days === 1
          ? 'DATE(dl.started_at) = CURDATE()'
          : 'dl.started_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
        
        const breakdownQuery = `
          SELECT 
            ing.name,
            ing.type,
            SUM(
              CASE 
                WHEN ri.unit = 'cl' THEN ri.quantity * 10 * ing.cost_per_unit
                WHEN ri.unit = 'l' THEN ri.quantity * 1000 * ing.cost_per_unit
                ELSE ri.quantity * ing.cost_per_unit
              END
            ) as total_ingredient_cost,
            COUNT(DISTINCT dl.id) as uses_count
          FROM dispensing_log dl
          JOIN recipe_ingredients ri ON dl.recipe_id = ri.recipe_id
          JOIN ingredients ing ON ri.ingredient_id = ing.id
          WHERE dl.status = "completed"
            AND ${breakdownDateFilter}
          GROUP BY ing.id, ing.name, ing.type
          ORDER BY total_ingredient_cost DESC
          LIMIT 10
        `;
        
        db.query(breakdownQuery, queryParams, (err, results) => {
          if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
          }
          
          stats.ingredient_breakdown = results.map(r => ({
            name: r.name,
            type: r.ingredient_type,
            cost: parseFloat(r.total_ingredient_cost || 0),
            uses: r.uses_count
          }));
          
          res.json(stats);
        });
      });
    });
  });
});

module.exports = router;
