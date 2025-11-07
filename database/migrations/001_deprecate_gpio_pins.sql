-- Migration: Deprecate GPIO pin fields in pumps table
-- Date: 2025-11-07
-- Description: GPIO pins are now managed by ESP32 firmware config, not database
-- This migration makes gpio_pin and flow_meter_pin nullable and adds deprecation comments

-- Make gpio_pin and flow_meter_pin nullable if not already
ALTER TABLE pumps 
MODIFY COLUMN gpio_pin INT NULL COMMENT 'DEPRECATED: GPIO managed by ESP32 config (IntelliVend_ESP32/config.h)',
MODIFY COLUMN flow_meter_pin INT NULL COMMENT 'DEPRECATED: Flow meter pins managed by ESP32 config (IntelliVend_ESP32/config.h)';

-- Optional: Clear existing GPIO pin values (uncomment if you want to clean up)
-- UPDATE pumps SET gpio_pin = NULL, flow_meter_pin = NULL;

-- Add informational note
SELECT 'Migration completed: GPIO pins are now managed in ESP32 firmware config' AS status;
