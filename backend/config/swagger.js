const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IntelliVend API',
      version: '1.0.17',
      description: 'IntelliVend REST API - Intelligens italautomata rendszer API dokumentáció',
      contact: {
        name: 'IntelliVend Team',
        url: 'https://github.com/vinczem/IntelliVend'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '/',
        description: 'Current server (works in both standalone and Home Assistant addon)'
      }
    ],
    tags: [
      { name: 'Health', description: 'Rendszer állapota' },
      { name: 'Ingredients', description: 'Alapanyag kezelés' },
      { name: 'Pumps', description: 'Pumpa kezelés és kalibráció' },
      { name: 'Recipes', description: 'Recept kezelés' },
      { name: 'Inventory', description: 'Készlet nyilvántartás' },
      { name: 'Dispense', description: 'Ital készítés és adagolás' },
      { name: 'Alerts', description: 'Riasztások és értesítések' },
      { name: 'Stats', description: 'Statisztikák és jelentések' },
      { name: 'Email', description: 'Email értesítések' },
      { name: 'Maintenance', description: 'Karbantartás és öblítés' },
      { name: 'Backup', description: 'Adatbázis mentés és visszaállítás' }
    ],
    components: {
      schemas: {
        Ingredient: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Vodka' },
            description: { type: 'string', example: 'Tiszta, semleges ízű párlat' },
            type: { type: 'string', enum: ['alcohol', 'non-alcohol', 'mixer', 'syrup', 'juice', 'other'], example: 'alcohol' },
            alcohol_percentage: { type: 'number', format: 'float', example: 40.0 },
            unit: { type: 'string', enum: ['ml', 'cl', 'l'], example: 'ml' },
            cost_per_unit: { type: 'number', format: 'float', example: 2.5 },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Pump: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            pump_number: { type: 'integer', example: 1 },
            ingredient_id: { type: 'integer', nullable: true, example: 5 },
            gpio_pin: { type: 'integer', example: 16 },
            flow_meter_pin: { type: 'integer', nullable: true, example: 17 },
            is_active: { type: 'boolean', example: true },
            calibration_factor: { type: 'number', format: 'float', example: 1.0 },
            notes: { type: 'string', example: 'Baloldali alsó pumpa' },
            ingredient_name: { type: 'string', example: 'Vodka' },
            current_quantity: { type: 'number', example: 750 },
            bottle_size: { type: 'number', example: 1000 }
          }
        },
        Recipe: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Mojito' },
            description: { type: 'string', example: 'Frissítő kubai koktél mentával' },
            category: { type: 'string', enum: ['cocktail', 'shot', 'long-drink', 'mocktail', 'other'], example: 'cocktail' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], example: 'medium' },
            glass_type: { type: 'string', example: 'Highball' },
            garnish: { type: 'string', example: 'Menta levél, lime' },
            instructions: { type: 'string', example: 'Menta leveleket összetörni...' },
            is_alcoholic: { type: 'boolean', example: true },
            total_volume_ml: { type: 'integer', example: 300 },
            image_url: { type: 'string', example: '/uploads/recipes/mojito.jpg' },
            is_active: { type: 'boolean', example: true },
            popularity: { type: 'integer', example: 42 }
          }
        },
        Alert: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            type: { type: 'string', enum: ['low_stock', 'empty_bottle', 'system_error', 'maintenance_required'], example: 'low_stock' },
            severity: { type: 'string', enum: ['info', 'warning', 'critical'], example: 'warning' },
            message: { type: 'string', example: 'Alacsony készlet: Vodka (200ml)' },
            related_ingredient_id: { type: 'integer', nullable: true, example: 5 },
            related_pump_id: { type: 'integer', nullable: true, example: 1 },
            is_resolved: { type: 'boolean', example: false },
            created_at: { type: 'string', format: 'date-time' },
            resolved_at: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Database error' },
            details: { type: 'string', example: 'Connection timeout' }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js', './server.js'] // Path to the API docs
};

module.exports = swaggerJsdoc(options);
