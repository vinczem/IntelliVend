-- IntelliVend - Minta adatok teszteléshez

-- Minta alapanyagok
INSERT INTO ingredients (name, description, type, alcohol_percentage, unit, cost_per_unit) VALUES
-- Alkoholok
('Vodka', 'Tiszta vodka', 'alcohol', 40.00, 'ml', 0.05),
('Rum', 'Fehér rum', 'alcohol', 40.00, 'ml', 0.06),
('Gin', 'London Dry Gin', 'alcohol', 42.00, 'ml', 0.07),
('Tequila', 'Ezüst tequila', 'alcohol', 38.00, 'ml', 0.08),
('Whiskey', 'Bourbon whiskey', 'alcohol', 40.00, 'ml', 0.10),

-- Mixerek
('Coca Cola', 'Klasszikus kóla', 'mixer', 0.00, 'ml', 0.01),
('Tonic Water', 'Tonik víz', 'mixer', 0.00, 'ml', 0.02),
('Sprite', 'Citromos üdítő', 'mixer', 0.00, 'ml', 0.01),
('Gyömbérsör', 'Ginger ale', 'mixer', 0.00, 'ml', 0.02),

-- Levek
('Narancslé', 'Frissen facsart narancslé', 'juice', 0.00, 'ml', 0.03),
('Lime lé', 'Friss lime lé', 'juice', 0.00, 'ml', 0.04),
('Cranberry lé', 'Áfonyalé', 'juice', 0.00, 'ml', 0.03),
('Ananászlé', 'Ananász lé', 'juice', 0.00, 'ml', 0.03),

-- Szirupok
('Grenadine szirup', 'Gránátalma szirup', 'syrup', 0.00, 'ml', 0.05),
('Cukor szirup', 'Egyszerű cukor szirup', 'syrup', 0.00, 'ml', 0.02);

-- Minta pumpák (8 db)
INSERT INTO pumps (pump_number, ingredient_id, gpio_pin, flow_meter_pin, calibration_factor, notes) VALUES
(1, 1, 2, 14, 1.0000, 'Vodka pumpa'),
(2, 2, 4, 12, 1.0000, 'Rum pumpa'),
(3, 3, 5, 13, 1.0000, 'Gin pumpa'),
(4, 6, 18, 15, 1.0000, 'Coca Cola pumpa'),
(5, 7, 19, 16, 1.0000, 'Tonic pumpa'),
(6, 10, 21, 17, 1.0000, 'Narancslé pumpa'),
(7, 11, 22, 23, 1.0000, 'Lime lé pumpa'),
(8, 15, 25, 26, 1.0000, 'Cukor szirup pumpa');

-- Készlet adatok (feltételezzük 700ml-es üvegeket)
INSERT INTO inventory (pump_id, ingredient_id, initial_quantity, current_quantity, bottle_size, min_quantity_alert, unit) VALUES
(1, 1, 700.00, 700.00, 700.00, 100.00, 'ml'),
(2, 2, 700.00, 700.00, 700.00, 100.00, 'ml'),
(3, 3, 700.00, 700.00, 700.00, 100.00, 'ml'),
(4, 6, 2000.00, 2000.00, 2000.00, 200.00, 'ml'),
(5, 7, 1000.00, 1000.00, 1000.00, 150.00, 'ml'),
(6, 10, 1000.00, 1000.00, 1000.00, 150.00, 'ml'),
(7, 11, 500.00, 500.00, 500.00, 50.00, 'ml'),
(8, 15, 500.00, 500.00, 500.00, 50.00, 'ml');

-- Minta receptek
INSERT INTO recipes (name, description, category, difficulty, glass_type, is_alcoholic, total_volume_ml, is_active, popularity) VALUES
('Vodka Cola', 'Klasszikus vodka kólával', 'long-drink', 'easy', 'Highball', TRUE, 250, TRUE, 100),
('Rum Cola', 'Cuba Libre rum kólával', 'long-drink', 'easy', 'Highball', TRUE, 250, TRUE, 95),
('Gin Tonic', 'Klasszikus gin tonikkal', 'long-drink', 'easy', 'Highball', TRUE, 250, TRUE, 90),
('Screwdriver', 'Vodka narancslével', 'long-drink', 'easy', 'Highball', TRUE, 250, TRUE, 85),
('Virgin Mojito', 'Alkoholmentes mojito', 'mocktail', 'medium', 'Highball', FALSE, 300, TRUE, 70),
('Narancsle', 'Egyszerű narancslé', 'mocktail', 'easy', 'Tumbler', FALSE, 200, TRUE, 60);

-- Recept hozzávalók
-- Vodka Cola
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, order_number) VALUES
(1, 1, 50, 'ml', 1),  -- Vodka
(1, 6, 200, 'ml', 2); -- Coca Cola

-- Rum Cola
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, order_number) VALUES
(2, 2, 50, 'ml', 1),  -- Rum
(2, 6, 200, 'ml', 2); -- Coca Cola

-- Gin Tonic
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, order_number) VALUES
(3, 3, 50, 'ml', 1),  -- Gin
(3, 7, 200, 'ml', 2); -- Tonic

-- Screwdriver
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, order_number) VALUES
(4, 1, 50, 'ml', 1),  -- Vodka
(4, 10, 200, 'ml', 2); -- Narancslé

-- Virgin Mojito (egyszerűsített)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, order_number) VALUES
(5, 11, 30, 'ml', 1),  -- Lime lé
(5, 15, 20, 'ml', 2),  -- Cukor szirup
(5, 8, 250, 'ml', 3);  -- Sprite

-- Narancslé
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, order_number) VALUES
(6, 10, 200, 'ml', 1); -- Narancslé
