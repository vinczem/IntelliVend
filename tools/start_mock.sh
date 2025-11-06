#!/bin/bash
#
# ESP32 Mock Client indító szkript
# Használat: ./start_mock.sh
#

# MQTT hitelesítési adatok
MQTT_USER="username"
MQTT_PASS="password"

# Python executable
PYTHON="/Users/vmihaly/dev/IntelliVend/.venv/bin/python"

# Mock script path
SCRIPT_PATH="/Users/vmihaly/dev/IntelliVend/tools/esp32_mock.py"

echo "🚀 Indítás: ESP32 Mock Client"
echo "========================================"

# Leállítjuk az esetleg futó régi instance-t
pkill -f "esp32_mock.py" 2>/dev/null

# Indítás
PYTHONWARNINGS="ignore::DeprecationWarning" \
  $PYTHON $SCRIPT_PATH \
  --username $MQTT_USER \
  --password $MQTT_PASS \
  "$@"
