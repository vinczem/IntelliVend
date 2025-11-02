const express = require('express');
const router = express.Router();
const db = require('../config/database');

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

module.exports = router;
