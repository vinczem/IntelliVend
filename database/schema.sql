-- IntelliVend Database Schema
-- MySQL/MariaDB

-- Alapanyagok táblája
CREATE TABLE IF NOT EXISTS ingredients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type ENUM('alcohol', 'non-alcohol', 'mixer', 'syrup', 'juice', 'other') NOT NULL,
    alcohol_percentage DECIMAL(4,2) DEFAULT 0.00,
    unit ENUM('ml', 'cl', 'l') DEFAULT 'ml',
    cost_per_unit DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pumpák táblája
CREATE TABLE IF NOT EXISTS pumps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pump_number INT NOT NULL UNIQUE COMMENT 'Pumpa sorszáma (1-8) - ESP32 config alapján határozza meg a GPIO-t',
    ingredient_id INT NULL,
    gpio_pin INT NULL COMMENT 'DEPRECATED: GPIO managed by ESP32 config',
    flow_meter_pin INT NULL COMMENT 'DEPRECATED: Flow meter pins managed by ESP32 config',
    is_active BOOLEAN DEFAULT TRUE,
    calibration_factor DECIMAL(10,4) DEFAULT 1.0000,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE SET NULL,
    INDEX idx_pump_number (pump_number),
    INDEX idx_ingredient (ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Készlet nyilvántartás
CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pump_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    initial_quantity DECIMAL(10,2) NOT NULL,
    current_quantity DECIMAL(10,2) NOT NULL,
    min_quantity_alert DECIMAL(10,2) DEFAULT 100.00,
    bottle_size DECIMAL(10,2) NOT NULL,
    unit ENUM('ml', 'cl', 'l') DEFAULT 'ml',
    refilled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pump_id) REFERENCES pumps(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    INDEX idx_pump (pump_id),
    INDEX idx_low_stock (current_quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Receptek táblája
CREATE TABLE IF NOT EXISTS recipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category ENUM('cocktail', 'shot', 'long-drink', 'mocktail', 'other') NOT NULL,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'easy',
    glass_type VARCHAR(50),
    garnish VARCHAR(100),
    instructions TEXT,
    is_alcoholic BOOLEAN DEFAULT FALSE,
    total_volume_ml INT DEFAULT 0,
    image_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    popularity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_alcoholic (is_alcoholic),
    INDEX idx_active (is_active),
    INDEX idx_popularity (popularity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recept hozzávalók (kapcsolótábla mennyiségekkel)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit ENUM('ml', 'cl', 'l', 'dash', 'splash') DEFAULT 'ml',
    order_number INT DEFAULT 1,
    is_optional BOOLEAN DEFAULT FALSE,
    notes VARCHAR(255),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    INDEX idx_recipe (recipe_id),
    INDEX idx_ingredient (ingredient_id),
    UNIQUE KEY unique_recipe_ingredient (recipe_id, ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kiadási napló (történet)
CREATE TABLE IF NOT EXISTS dispensing_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT NULL,
    recipe_name VARCHAR(150) NOT NULL,
    total_volume_ml DECIMAL(10,2) NOT NULL,
    status ENUM('started', 'in_progress', 'completed', 'failed', 'cancelled') NOT NULL,
    error_message TEXT NULL,
    notes TEXT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    duration_seconds INT NULL,
    INDEX idx_recipe (recipe_id),
    INDEX idx_status (status),
    INDEX idx_started (started_at),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kiadási részletek (melyik pumpából mennyi ment)
CREATE TABLE IF NOT EXISTS dispensing_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_id INT NOT NULL,
    pump_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    ingredient_name VARCHAR(100) NOT NULL,
    quantity_ml DECIMAL(10,2) NOT NULL,
    order_number INT NOT NULL,
    status ENUM('pending', 'dispensing', 'completed', 'failed') DEFAULT 'pending',
    dispensed_at TIMESTAMP NULL,
    FOREIGN KEY (log_id) REFERENCES dispensing_log(id) ON DELETE CASCADE,
    FOREIGN KEY (pump_id) REFERENCES pumps(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    INDEX idx_log (log_id),
    INDEX idx_pump (pump_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Riasztások/értesítések
CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('low_stock', 'empty_bottle', 'system_error', 'maintenance') NOT NULL,
    severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
    message TEXT NOT NULL,
    related_pump_id INT NULL,
    related_ingredient_id INT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (related_pump_id) REFERENCES pumps(id) ON DELETE CASCADE,
    FOREIGN KEY (related_ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    INDEX idx_type (type),
    INDEX idx_severity (severity),
    INDEX idx_resolved (is_resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rendszer beállítások
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alapértelmezett beállítások beszúrása
INSERT INTO settings (setting_key, setting_value, description) VALUES
('max_drink_size_ml', '500', 'Maximális ital méret ml-ben'),
('pump_timeout_seconds', '60', 'Pumpa timeout másodpercben'),
('enable_alerts', 'true', 'Email/push értesítések engedélyezése'),
('low_stock_threshold_ml', '100', 'Alacsony készlet küszöb ml-ben'),
('maintenance_mode', 'false', 'Karbantartási mód')
ON DUPLICATE KEY UPDATE setting_value=setting_value;
