const express = require('express');
const router = express.Router();
const db = require('../config/database');
const upload = require('../config/upload');
const path = require('path');
const fs = require('fs');

/**
 * @swagger
 * /api/recipes:
 *   get:
 *     summary: Összes recept lekérése
 *     description: Receptek lekérése szűrési lehetőségekkel (kategória, alkoholos, elérhető)
 *     tags: [Recipes]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [classic, modern, shooter, mocktail, tropical, seasonal]
 *         description: Kategória szerinti szűrés
 *       - in: query
 *         name: is_alcoholic
 *         schema:
 *           type: boolean
 *         description: Alkoholos vagy alkoholmentes receptek
 *       - in: query
 *         name: available_only
 *         schema:
 *           type: boolean
 *         description: Csak az elérhető receptek (ahol van minden alapanyag)
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Recipe'
 *       500:
 *         description: Adatbázis hiba
 */
// GET all recipes (with filter options)
router.get('/', (req, res) => {
  const { category, is_alcoholic, available_only } = req.query;
  
  let query = `
    SELECT r.*, 
           COUNT(DISTINCT ri.id) as ingredient_count,
           GROUP_CONCAT(DISTINCT i.name ORDER BY ri.order_number SEPARATOR ', ') as ingredients_list
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    LEFT JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE r.is_active = 1
  `;
  
  const params = [];
  
  if (category && category !== '') {
    query += ' AND r.category = ?';
    params.push(category);
  }
  
  if (is_alcoholic !== undefined && is_alcoholic !== '') {
    query += ' AND r.is_alcoholic = ?';
    params.push(is_alcoholic === 'true' ? 1 : 0);
  }
  
  query += ' GROUP BY r.id ORDER BY r.popularity DESC, r.name';
  
  db.query(query, params, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    // Ha csak a elérhető recepteket kéri (ahol van minden alapanyag)
    if (available_only === 'true') {
      filterAvailableRecipes(results, res);
    } else {
      res.json(results);
    }
  });
});

// Helper function to filter available recipes
function filterAvailableRecipes(recipes, res) {
  const checkQuery = `
    SELECT ri.recipe_id, ri.ingredient_id, ri.quantity,
           inv.current_quantity, p.is_active
    FROM recipe_ingredients ri
    LEFT JOIN inventory inv ON ri.ingredient_id = inv.ingredient_id
    LEFT JOIN pumps p ON inv.pump_id = p.id
    WHERE ri.recipe_id IN (?)
  `;
  
  const recipeIds = recipes.map(r => r.id);
  
  db.query(checkQuery, [recipeIds], (err, ingredients) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    const availableRecipes = recipes.filter(recipe => {
      const recipeIngredients = ingredients.filter(i => i.recipe_id === recipe.id);
      
      return recipeIngredients.every(ing => {
        const requiredQty = parseFloat(ing.quantity);
        const availableQty = parseFloat(ing.current_quantity);
        return availableQty >= requiredQty && ing.is_active === 1;
      });
    });
    
    res.json(availableRecipes);
  });
}

/**
 * @swagger
 * /api/recipes/{id}:
 *   get:
 *     summary: Recept lekérése ID alapján
 *     description: Egy konkrét recept részletes adatai az alapanyagokkal együtt
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A recept ID-ja
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Recipe'
 *       404:
 *         description: Recept nem található
 *       500:
 *         description: Adatbázis hiba
 */
// GET recipe by ID with full details
router.get('/:id', (req, res) => {
  const recipeQuery = 'SELECT * FROM recipes WHERE id = ?';
  
  db.query(recipeQuery, [req.params.id], (err, recipeResults) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (recipeResults.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    const recipe = recipeResults[0];
    
    // Get ingredients
    const ingredientsQuery = `
      SELECT ri.*, i.name, i.type, i.alcohol_percentage, i.unit as ingredient_unit,
             inv.current_quantity, p.pump_number, p.is_active
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      LEFT JOIN inventory inv ON i.id = inv.ingredient_id
      LEFT JOIN pumps p ON inv.pump_id = p.id
      WHERE ri.recipe_id = ?
      ORDER BY ri.order_number
    `;
    
    db.query(ingredientsQuery, [req.params.id], (err, ingredients) => {
      if (err) {
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      
      recipe.ingredients = ingredients;
      recipe.is_available = ingredients.every(i => {
        const requiredQty = parseFloat(i.quantity);
        const availableQty = parseFloat(i.current_quantity || 0);
        return availableQty >= requiredQty && i.is_active;
      });
      
      res.json(recipe);
    });
  });
});

/**
 * @swagger
 * /api/recipes:
 *   post:
 *     summary: Új recept létrehozása
 *     description: Új recept hozzáadása az alapanyagokkal együtt
 *     tags: [Recipes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - is_alcoholic
 *               - ingredients
 *             properties:
 *               name:
 *                 type: string
 *                 example: Mojito
 *               description:
 *                 type: string
 *                 example: Frissítő kubai koktél
 *               category:
 *                 type: string
 *                 enum: [classic, modern, shooter, mocktail, tropical, seasonal]
 *                 example: classic
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *                 example: easy
 *               glass_type:
 *                 type: string
 *                 example: Highball
 *               garnish:
 *                 type: string
 *                 example: Menta levél, lime szelet
 *               instructions:
 *                 type: string
 *                 example: Zúzd össze a mentát cukorral...
 *               is_alcoholic:
 *                 type: boolean
 *                 example: true
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ingredient_id:
 *                       type: integer
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *                     order_number:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Recept sikeresen létrehozva
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 id:
 *                   type: integer
 *       500:
 *         description: Adatbázis hiba
 */
// POST new recipe
router.post('/', (req, res) => {
  const { name, description, category, difficulty, glass_type, garnish, instructions, is_alcoholic, ingredients } = req.body;
  
  db.getConnection((connErr, conn) => {
    if (connErr) {
      return res.status(500).json({ error: 'Database connection error', details: connErr.message });
    }
    
    conn.beginTransaction((err) => {
      if (err) {
        conn.release();
        return res.status(500).json({ error: 'Transaction error', details: err.message });
      }
      
      // Calculate total volume
      const total_volume_ml = ingredients.reduce((sum, ing) => {
        const quantity = ing.unit === 'ml' ? ing.quantity : 
                        ing.unit === 'cl' ? ing.quantity * 10 : 
                        ing.unit === 'l' ? ing.quantity * 1000 : 0;
        return sum + quantity;
      }, 0);
      
      const recipeQuery = `
        INSERT INTO recipes (name, description, category, difficulty, glass_type, garnish, instructions, is_alcoholic, total_volume_ml)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      conn.query(recipeQuery, [name, description, category, difficulty, glass_type, garnish, instructions, is_alcoholic, total_volume_ml], (err, result) => {
        if (err) {
          return conn.rollback(() => {
            conn.release();
            res.status(500).json({ error: 'Database error', details: err.message });
          });
        }
        
        const recipeId = result.insertId;
        
        // Insert ingredients
        const ingredientValues = ingredients.map((ing, index) => [
          recipeId, ing.ingredient_id, ing.quantity, ing.unit || 'ml', index + 1, ing.is_optional || false, ing.notes || null
        ]);
        
        const ingredientsQuery = 'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, order_number, is_optional, notes) VALUES ?';
        
        conn.query(ingredientsQuery, [ingredientValues], (err) => {
          if (err) {
            return conn.rollback(() => {
              conn.release();
              res.status(500).json({ error: 'Database error', details: err.message });
            });
          }
          
          conn.commit((err) => {
            if (err) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({ error: 'Commit error', details: err.message });
              });
            }
            conn.release();
            res.status(201).json({ id: recipeId, message: 'Recipe created successfully' });
          });
        });
      });
    });
  });
});

/**
 * @swagger
 * /api/recipes/{id}:
 *   put:
 *     summary: Recept módosítása
 *     description: Meglévő recept frissítése az alapanyagokkal együtt
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A recept ID-ja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [classic, modern, shooter, mocktail, tropical, seasonal]
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *               glass_type:
 *                 type: string
 *               garnish:
 *                 type: string
 *               instructions:
 *                 type: string
 *               is_alcoholic:
 *                 type: boolean
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ingredient_id:
 *                       type: integer
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *                     order_number:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Recept sikeresen frissítve
 *       404:
 *         description: Recept nem található
 *       500:
 *         description: Adatbázis hiba
 */
// PUT update recipe
router.put('/:id', (req, res) => {
  const { name, description, category, difficulty, glass_type, garnish, instructions, is_alcoholic, ingredients } = req.body;
  
  db.getConnection((connErr, conn) => {
    if (connErr) {
      return res.status(500).json({ error: 'Database connection error', details: connErr.message });
    }
    
    conn.beginTransaction((err) => {
      if (err) {
        conn.release();
        return res.status(500).json({ error: 'Transaction error', details: err.message });
      }
      
      // Calculate total volume
      const total_volume_ml = ingredients.reduce((sum, ing) => {
        const quantity = ing.unit === 'ml' ? ing.quantity : 
                        ing.unit === 'cl' ? ing.quantity * 10 : 
                        ing.unit === 'l' ? ing.quantity * 1000 : 0;
        return sum + quantity;
      }, 0);
      
      const recipeQuery = `
        UPDATE recipes 
        SET name = ?, description = ?, category = ?, difficulty = ?, glass_type = ?, 
            garnish = ?, instructions = ?, is_alcoholic = ?, total_volume_ml = ?
        WHERE id = ?
      `;
      
      conn.query(recipeQuery, [name, description, category, difficulty, glass_type, garnish, instructions, is_alcoholic, total_volume_ml, req.params.id], (err, result) => {
        if (err) {
          return conn.rollback(() => {
            conn.release();
            res.status(500).json({ error: 'Database error', details: err.message });
          });
        }
        
        if (result.affectedRows === 0) {
          return conn.rollback(() => {
            conn.release();
            res.status(404).json({ error: 'Recipe not found' });
          });
        }
        
        // Delete old ingredients
        const deleteIngredientsQuery = 'DELETE FROM recipe_ingredients WHERE recipe_id = ?';
        conn.query(deleteIngredientsQuery, [req.params.id], (err) => {
          if (err) {
            return conn.rollback(() => {
              conn.release();
              res.status(500).json({ error: 'Database error', details: err.message });
            });
          }
          
          // Insert new ingredients
          const ingredientValues = ingredients.map((ing, index) => [
            req.params.id, ing.ingredient_id, ing.quantity, ing.unit || 'ml', index + 1, ing.is_optional || false, ing.notes || null
          ]);
          
          const ingredientsQuery = 'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, order_number, is_optional, notes) VALUES ?';
          
          conn.query(ingredientsQuery, [ingredientValues], (err) => {
            if (err) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({ error: 'Database error', details: err.message });
              });
            }
            
            conn.commit((err) => {
              if (err) {
                return conn.rollback(() => {
                  conn.release();
                  res.status(500).json({ error: 'Commit error', details: err.message });
                });
              }
              conn.release();
              res.json({ message: 'Recipe updated successfully' });
            });
          });
        });
      });
    });
  });
});

/**
 * @swagger
 * /api/recipes/{id}:
 *   delete:
 *     summary: Recept törlése
 *     description: Recept törlése az adatbázisból
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A törlendő recept ID-ja
 *     responses:
 *       200:
 *         description: Recept sikeresen törölve
 *       404:
 *         description: Recept nem található
 *       500:
 *         description: Adatbázis hiba
 */
// DELETE recipe
router.delete('/:id', (req, res) => {
  const query = 'DELETE FROM recipes WHERE id = ?';
  
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json({ message: 'Recipe deleted successfully' });
  });
});

/**
 * @swagger
 * /api/recipes/{id}/image:
 *   post:
 *     summary: Recept kép feltöltése
 *     description: Kép feltöltése egy recepthez
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A recept ID-ja
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: A feltöltendő kép fájl (JPG, PNG, WEBP)
 *     responses:
 *       200:
 *         description: Kép sikeresen feltöltve
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 image_url:
 *                   type: string
 *       400:
 *         description: Hiányzó kép fájl
 *       404:
 *         description: Recept nem található
 *       500:
 *         description: Adatbázis hiba
 */
// POST /api/recipes/:id/image - Upload recipe image
router.post('/:id/image', upload.single('image'), (req, res) => {
  const recipeId = req.params.id;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  
  // Check if recipe exists
  db.query('SELECT id, image_url FROM recipes WHERE id = ?', [recipeId], (err, results) => {
    if (err) {
      // Delete uploaded file on error
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    if (results.length === 0) {
      // Delete uploaded file if recipe doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    const oldImageUrl = results[0].image_url;
    
    // Delete old image file if exists
    if (oldImageUrl) {
      const oldImagePath = path.join(__dirname, '../uploads/recipes', path.basename(oldImageUrl));
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    // Generate URL for the uploaded image
    const imageUrl = `/uploads/recipes/${req.file.filename}`;
    
    // Update database with new image URL
    db.query('UPDATE recipes SET image_url = ? WHERE id = ?', [imageUrl, recipeId], (err, result) => {
      if (err) {
        // Delete uploaded file on error
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: 'Failed to update recipe', details: err.message });
      }
      
      res.json({
        message: 'Image uploaded successfully',
        image_url: imageUrl
      });
    });
  });
});

/**
 * @swagger
 * /api/recipes/{id}/image:
 *   delete:
 *     summary: Recept kép törlése
 *     description: Törli a recepthez feltöltött képet
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: A recept ID-ja
 *     responses:
 *       200:
 *         description: Kép sikeresen törölve
 *       404:
 *         description: Recept nem található vagy nincs képe
 *       500:
 *         description: Adatbázis hiba
 */
// DELETE /api/recipes/:id/image - Delete recipe image
router.delete('/:id/image', (req, res) => {
  const recipeId = req.params.id;
  
  // Get current image URL
  db.query('SELECT image_url FROM recipes WHERE id = ?', [recipeId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    const imageUrl = results[0].image_url;
    
    if (!imageUrl) {
      return res.status(404).json({ error: 'Recipe has no image' });
    }
    
    // Delete image file
    const imagePath = path.join(__dirname, '../uploads/recipes', path.basename(imageUrl));
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    // Update database to remove image URL
    db.query('UPDATE recipes SET image_url = NULL WHERE id = ?', [recipeId], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update recipe', details: err.message });
      }
      
      res.json({ message: 'Image deleted successfully' });
    });
  });
});

module.exports = router;
