const mysql = require('mysql2');
const logger = require('./logger');


// Eredeti objektum-alapú pool (ha vissza kellene állítani):
// const pool = mysql.createPool({
//   host: process.env.DB_HOST || 'localhost',
//   port: process.env.DB_PORT || 3306,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
//   charset: 'utf8mb4',
//   collation: 'utf8mb4_unicode_ci'
// });

// Connection stringes pool létrehozás, charset=utf8mb4 paraméterrel
const pool = mysql.createPool(
  `mysql://${process.env.DB_USER}:${process.env.DB_PASSWORD}` +
  `@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?charset=utf8mb4`
);

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    // Log to both logger and console to ensure we see the error
    console.error('Database connection failed:', err);
    logger.error('Database connection failed:', err);
    // Don't exit immediately - let the app try to reconnect
    // process.exit(1);
  }
  if (connection) {
    logger.info('Database connected successfully');
    connection.release();
  }
});

module.exports = pool;
