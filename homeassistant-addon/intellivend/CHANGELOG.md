# Changelog

All notable changes to this add-on will be documented in this file.

## [1.0.3] - 2025-11-05

### Fixed
- WebSocket (Socket.IO) connection now works properly through Ingress
- Changed WebSocket URL detection to use current location origin
- Updated Nginx configuration to proxy `/socket.io/` endpoint (was `/ws`)
- Added proper Socket.IO path configuration for Ingress compatibility
- Increased WebSocket proxy timeout to 24 hours for long-lived connections
- Real-time status indicator now connects and shows "Connected" status

## [1.0.2] - 2025-11-05

### Fixed
- Ingress API path detection now correctly identifies Home Assistant Ingress URLs
- API calls now properly use `/api/hassio_ingress/TOKEN/api/` path structure
- Fixed API endpoints returning 404 when accessed through Ingress panel

## [1.0.1] - 2025-11-05

### Fixed
- API URL configuration for Home Assistant Ingress compatibility
- Fixed 404 errors when accessing API endpoints through Ingress
- Changed API baseURL from absolute to relative paths (/api)
- Removed hardcoded hostname from frontend configuration

## [1.0.0] - 2025-11-05

### Added
- Initial release of IntelliVend Home Assistant Add-on
- Complete recipe management system
- ESP32 integration via MQTT
- Real-time inventory tracking
- Multi-pump control system
- Web-based user interface with ingress support
- Pump calibration tools
- Dispensing statistics and history
- Email alerts for low inventory
- Backup and restore functionality
- Health check endpoints
- Automatic database initialization
- Support for multiple architectures (armhf, armv7, aarch64, amd64, i386)

### Features
- **Recipe Management**: Create, edit, and delete cocktail recipes
- **Ingredient Database**: Comprehensive ingredient tracking with types and costs
- **Pump Control**: Up to 16 pumps with GPIO configuration
- **Inventory System**: Real-time stock levels with alerts
- **MQTT Communication**: Reliable ESP32 device communication
- **Statistics**: Detailed dispensing history and usage analytics
- **Maintenance Mode**: Pump testing and calibration
- **Email Notifications**: Automatic alerts for low stock
- **Data Backup**: Full database backup and restore
- **Responsive UI**: Touch-friendly interface for all devices

### Configuration
- MySQL/MariaDB database support
- MQTT broker integration (Mosquitto)
- Configurable log levels
- Flexible database and MQTT settings

### Technical
- Node.js backend with Express
- MySQL2 database driver
- MQTT.js for device communication
- Socket.io for real-time updates
- Nginx reverse proxy
- Production-ready with health checks

### Documentation
- Complete README with installation guide
- Hardware requirements documentation
- MQTT topic reference
- Configuration examples

## [Unreleased]

### Planned Features
- Home Assistant entity integration
- Voice control support (Alexa, Google Assistant)
- Recipe sharing community
- Mobile app
- Advanced scheduling
- Multi-language support
- Theme customization

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
