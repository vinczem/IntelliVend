const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all alerts
router.get('/', (req, res) => {
  const { is_resolved, severity, type } = req.query;
  
  let query = `
    SELECT a.*, i.name as ingredient_name, p.pump_number
    FROM alerts a
    LEFT JOIN ingredients i ON a.related_ingredient_id = i.id
    LEFT JOIN pumps p ON a.related_pump_id = p.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (is_resolved !== undefined) {
    query += ' AND a.is_resolved = ?';
    params.push(is_resolved === 'true' ? 1 : 0);
  }
  
  if (severity) {
    query += ' AND a.severity = ?';
    params.push(severity);
  }
  
  if (type) {
    query += ' AND a.type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY a.severity DESC, a.created_at DESC LIMIT 100';
  
  db.query(query, params, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(results);
  });
});

// PUT resolve alert
router.put('/:id/resolve', (req, res) => {
  const query = 'UPDATE alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = ?';
  
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ message: 'Alert resolved successfully' });
  });
});

// DELETE alert
router.delete('/:id', (req, res) => {
  const query = 'DELETE FROM alerts WHERE id = ?';
  
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ message: 'Alert deleted successfully' });
  });
});

module.exports = router;
