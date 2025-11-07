-- Migration: Remove GPIO pin dependency from backend
-- Date: 2025-11-07
-- Reason: GPIO pin configuration moved to ESP32 firmware
--         Backend only manages pump_number, ESP32 determines GPIO mapping

-- Make gpio_pin and flow_meter_pin nullable and add deprecation comment
ALTER TABLE pumps 
    MODIFY COLUMN gpio_pin INT NULL COMMENT 'DEPRECATED: GPIO managed by ESP32 config',
    MODIFY COLUMN flow_meter_pin INT NULL COMMENT 'DEPRECATED: Flow meter pins managed by ESP32 config';

-- Update existing records: set gpio_pin and flow_meter_pin to NULL
-- These are now managed entirely by ESP32 firmware configuration
UPDATE pumps SET gpio_pin = NULL, flow_meter_pin = NULL;

-- Add comment to pump_number to clarify its importance
ALTER TABLE pumps 
    MODIFY COLUMN pump_number INT NOT NULL UNIQUE COMMENT 'Pumpa sorszáma (1-8) - ESP32 config alapján határozza meg a GPIO-t';
