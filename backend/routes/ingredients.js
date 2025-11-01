const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { body, validationResult } = require('express-validator');

// GET all ingredients
router.get('/', (req, res) => {
  const query = 'SELECT * FROM ingredients ORDER BY name';
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    res.json(results);
  });
});

// GET ingredient by ID
router.get('/:id', (req, res) => {
  const query = 'SELECT * FROM ingredients WHERE id = ?';
  
  db.query(query, [req.params.id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json(results[0]);
  });
});

// POST new ingredient
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('type').isIn(['alcohol', 'non-alcohol', 'mixer', 'syrup', 'juice', 'other']).withMessage('Invalid type'),
    body('alcohol_percentage').optional().isFloat({ min: 0, max: 100 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, type, alcohol_percentage, unit, cost_per_unit } = req.body;
    const query = 'INSERT INTO ingredients (name, description, type, alcohol_percentage, unit, cost_per_unit) VALUES (?, ?, ?, ?, ?, ?)';
    
    db.query(query, [name, description, type, alcohol_percentage || 0, unit || 'ml', cost_per_unit || 0], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      res.status(201).json({ id: result.insertId, message: 'Ingredient created successfully' });
    });
  }
);

// PUT update ingredient
router.put('/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('type').optional().isIn(['alcohol', 'non-alcohol', 'mixer', 'syrup', 'juice', 'other']),
    body('alcohol_percentage').optional().isFloat({ min: 0, max: 100 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = [];
    const values = [];
    
    if (req.body.name !== undefined) {
      updates.push('name = ?');
      values.push(req.body.name);
    }
    if (req.body.description !== undefined) {
      updates.push('description = ?');
      values.push(req.body.description);
    }
    if (req.body.type !== undefined) {
      updates.push('type = ?');
      values.push(req.body.type);
    }
    if (req.body.alcohol_percentage !== undefined) {
      updates.push('alcohol_percentage = ?');
      values.push(req.body.alcohol_percentage);
    }
    if (req.body.unit !== undefined) {
      updates.push('unit = ?');
      values.push(req.body.unit);
    }
    if (req.body.cost_per_unit !== undefined) {
      updates.push('cost_per_unit = ?');
      values.push(req.body.cost_per_unit);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.params.id);
    const query = `UPDATE ingredients SET ${updates.join(', ')} WHERE id = ?`;
    
    db.query(query, values, (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }
      res.json({ message: 'Ingredient updated successfully' });
    });
  }
);

// DELETE ingredient
router.delete('/:id', (req, res) => {
  const query = 'DELETE FROM ingredients WHERE id = ?';
  
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json({ message: 'Ingredient deleted successfully' });
  });
});

module.exports = router;
