const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { body, validationResult } = require('express-validator');

/**
 * @swagger
 * /api/ingredients:
 *   get:
 *     summary: Összes alapanyag lekérése
 *     description: Visszaadja az összes alapanyagot ABC sorrendben
 *     tags: [Ingredients]
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ingredient'
 *       500:
 *         description: Adatbázis hiba
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/ingredients/{id}:
 *   get:
 *     summary: Egy alapanyag lekérése ID alapján
 *     description: Visszaad egy konkrét alapanyagot az ID alapján
 *     tags: [Ingredients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Az alapanyag ID-ja
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ingredient'
 *       404:
 *         description: Alapanyag nem található
 *       500:
 *         description: Adatbázis hiba
 */
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

/**
 * @swagger
 * /api/ingredients:
 *   post:
 *     summary: Új alapanyag létrehozása
 *     description: Új alapanyagot hoz létre a rendszerben
 *     tags: [Ingredients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: Gin
 *               description:
 *                 type: string
 *                 example: London Dry Gin
 *               type:
 *                 type: string
 *                 enum: [alcohol, non-alcohol, mixer, syrup, juice, other]
 *                 example: alcohol
 *               alcohol_percentage:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 37.5
 *               unit:
 *                 type: string
 *                 enum: [ml, cl, l]
 *                 example: ml
 *               cost_per_unit:
 *                 type: number
 *                 format: float
 *                 example: 3.5
 *     responses:
 *       201:
 *         description: Alapanyag sikeresen létrehozva
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 id:
 *                   type: integer
 *       400:
 *         description: Validációs hiba
 *       500:
 *         description: Adatbázis hiba
 */
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

/**
 * @swagger
 * /api/ingredients/{id}:
 *   put:
 *     summary: Alapanyag módosítása
 *     description: Meglévő alapanyag adatainak frissítése
 *     tags: [Ingredients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Az alapanyag ID-ja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Vodka
 *               description:
 *                 type: string
 *                 example: Premium Vodka
 *               type:
 *                 type: string
 *                 enum: [alcohol, non-alcohol, mixer, syrup, juice, other]
 *               alcohol_percentage:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 100
 *               unit:
 *                 type: string
 *                 enum: [ml, cl, l]
 *               cost_per_unit:
 *                 type: number
 *                 format: float
 *     responses:
 *       200:
 *         description: Alapanyag sikeresen frissítve
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Validációs hiba vagy nincs frissítendő mező
 *       404:
 *         description: Alapanyag nem található
 *       500:
 *         description: Adatbázis hiba
 */
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

/**
 * @swagger
 * /api/ingredients/{id}:
 *   delete:
 *     summary: Alapanyag törlése
 *     description: Alapanyag törlése az adatbázisból
 *     tags: [Ingredients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A törlendő alapanyag ID-ja
 *     responses:
 *       200:
 *         description: Alapanyag sikeresen törölve
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Alapanyag nem található
 *       500:
 *         description: Adatbázis hiba
 */
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
