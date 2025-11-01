const mysql = require('mysql2');
const logger = require('./logger');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    logger.error('Database connection failed:', err);
    process.exit(1);
  }
  if (connection) {
    logger.info('Database connected successfully');
    connection.release();
  }
});

module.exports = pool;
