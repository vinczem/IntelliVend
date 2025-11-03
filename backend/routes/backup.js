const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const multer = require('multer');

// Backup directory
const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Multer configuration for SQL file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, BACKUP_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, `restore-${Date.now()}.sql`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/sql' || 
            file.mimetype === 'text/plain' || 
            file.originalname.endsWith('.sql')) {
            cb(null, true);
        } else {
            cb(new Error('Only .sql files are allowed'));
        }
    }
});

// GET /api/backup/export - Export database to SQL file
router.get('/export', async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `intellivend-backup-${timestamp}.sql`;
        const filepath = path.join(BACKUP_DIR, filename);

        // Database credentials from environment
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbUser = process.env.DB_USER || 'root';
        const dbPassword = process.env.DB_PASSWORD || '';
        const dbName = process.env.DB_NAME || 'intellivend';

        logger.info(`Starting database backup: ${filename}`);

        // Try mysqldump first (works in Docker and if MySQL client installed)
        const dumpCommand = `mysqldump -h ${dbHost} -u ${dbUser} ${dbPassword ? `-p${dbPassword}` : ''} ${dbName} > "${filepath}"`;

        exec(dumpCommand, async (error, stdout, stderr) => {
            if (error && error.message.includes('command not found')) {
                // mysqldump not available, use Node.js fallback
                logger.warn('mysqldump not found, using Node.js fallback');
                
                try {
                    await exportDatabaseNodeJS(filepath, dbHost, dbUser, dbPassword, dbName);
                    
                    const stats = fs.statSync(filepath);
                    logger.info(`Backup completed (Node.js): ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

                    // Send file to client
                    res.download(filepath, filename, (err) => {
                        if (err) {
                            logger.error('Error sending backup file:', err);
                        }
                        
                        // Clean up backup file after download
                        setTimeout(() => {
                            if (fs.existsSync(filepath)) {
                                fs.unlinkSync(filepath);
                                logger.info(`Cleaned up backup file: ${filename}`);
                            }
                        }, 5000);
                    });
                } catch (nodeError) {
                    logger.error('Node.js backup error:', nodeError);
                    if (fs.existsSync(filepath)) {
                        fs.unlinkSync(filepath);
                    }
                    return res.status(500).json({ 
                        error: 'Database backup failed', 
                        details: nodeError.message 
                    });
                }
            } else if (error) {
                // Other mysqldump error
                logger.error('Backup error:', error);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
                return res.status(500).json({ 
                    error: 'Database backup failed', 
                    details: error.message 
                });
            } else {
                // mysqldump success
                if (!fs.existsSync(filepath)) {
                    return res.status(500).json({ 
                        error: 'Backup file was not created' 
                    });
                }

                const stats = fs.statSync(filepath);
                logger.info(`Backup completed: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

                // Send file to client
                res.download(filepath, filename, (err) => {
                    if (err) {
                        logger.error('Error sending backup file:', err);
                    }
                    
                    // Clean up backup file after download
                    setTimeout(() => {
                        if (fs.existsSync(filepath)) {
                            fs.unlinkSync(filepath);
                            logger.info(`Cleaned up backup file: ${filename}`);
                        }
                    }, 5000);
                });
            }
        });

    } catch (error) {
        logger.error('Backup error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Node.js fallback: Export database using mysql connection
async function exportDatabaseNodeJS(filepath, host, user, password, database) {
    return new Promise((resolve, reject) => {
        const db = require('../config/database');
        const writeStream = fs.createWriteStream(filepath);
        
        let sql = `-- IntelliVend Database Backup\n`;
        sql += `-- Generated: ${new Date().toISOString()}\n`;
        sql += `-- Database: ${database}\n\n`;
        sql += `SET NAMES utf8mb4;\n`;
        sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

        writeStream.write(sql);

        // Get all tables
        db.query('SHOW TABLES', (err, tables) => {
            if (err) return reject(err);

            let processedTables = 0;
            const tableNames = tables.map(t => Object.values(t)[0]);

            tableNames.forEach((table, index) => {
                // Get CREATE TABLE statement
                db.query(`SHOW CREATE TABLE \`${table}\``, (err, createResult) => {
                    if (err) {
                        logger.error(`Error getting CREATE TABLE for ${table}:`, err);
                        processedTables++;
                        if (processedTables === tableNames.length) finalize();
                        return;
                    }

                    const createSQL = createResult[0]['Create Table'];
                    writeStream.write(`-- Table: ${table}\n`);
                    writeStream.write(`DROP TABLE IF EXISTS \`${table}\`;\n`);
                    writeStream.write(createSQL + ';\n\n');

                    // Get table data
                    db.query(`SELECT * FROM \`${table}\``, (err, rows) => {
                        if (err) {
                            logger.error(`Error getting data for ${table}:`, err);
                        } else if (rows.length > 0) {
                            writeStream.write(`-- Data for table: ${table}\n`);
                            
                            rows.forEach((row) => {
                                const columns = Object.keys(row).map(k => `\`${k}\``).join(', ');
                                const values = Object.values(row).map(v => {
                                    if (v === null) return 'NULL';
                                    if (typeof v === 'number') return v;
                                    if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
                                    return `'${String(v).replace(/'/g, "''")}'`;
                                }).join(', ');
                                
                                writeStream.write(`INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`);
                            });
                            writeStream.write('\n');
                        }

                        processedTables++;
                        if (processedTables === tableNames.length) {
                            finalize();
                        }
                    });
                });
            });

            function finalize() {
                writeStream.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
                writeStream.end();
                writeStream.on('finish', () => resolve());
                writeStream.on('error', (err) => reject(err));
            }
        });
    });
}

// POST /api/backup/import - Import database from SQL file
router.post('/import', upload.single('sqlFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No SQL file uploaded' });
        }

        const filepath = req.file.path;
        logger.info(`Starting database restore from: ${req.file.filename}`);

        // Database credentials from environment
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbUser = process.env.DB_USER || 'root';
        const dbPassword = process.env.DB_PASSWORD || '';
        const dbName = process.env.DB_NAME || 'intellivend';

        // Try mysql client first
        const importCommand = `mysql -h ${dbHost} -u ${dbUser} ${dbPassword ? `-p${dbPassword}` : ''} ${dbName} < "${filepath}"`;

        exec(importCommand, async (error, stdout, stderr) => {
            if (error && error.message.includes('command not found')) {
                // mysql client not available, use Node.js fallback
                logger.warn('mysql client not found, using Node.js fallback');
                
                try {
                    await importDatabaseNodeJS(filepath, dbHost, dbUser, dbPassword, dbName);
                    
                    // Clean up uploaded file
                    if (fs.existsSync(filepath)) {
                        fs.unlinkSync(filepath);
                    }

                    logger.info(`Database restored successfully from: ${req.file.filename}`);
                    res.json({ 
                        message: 'Database restored successfully',
                        filename: req.file.originalname
                    });
                } catch (nodeError) {
                    // Clean up uploaded file
                    if (fs.existsSync(filepath)) {
                        fs.unlinkSync(filepath);
                    }
                    
                    logger.error('Node.js restore error:', nodeError);
                    return res.status(500).json({ 
                        error: 'Database restore failed', 
                        details: nodeError.message 
                    });
                }
            } else if (error) {
                // Clean up uploaded file
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
                
                logger.error('Restore error:', error);
                return res.status(500).json({ 
                    error: 'Database restore failed', 
                    details: error.message 
                });
            } else {
                // mysql client success
                // Clean up uploaded file
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }

                logger.info(`Database restored successfully from: ${req.file.filename}`);
                res.json({ 
                    message: 'Database restored successfully',
                    filename: req.file.originalname
                });
            }
        });

    } catch (error) {
        logger.error('Restore error:', error);
        
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Node.js fallback: Import database using mysql connection
async function importDatabaseNodeJS(filepath, host, user, password, database) {
    return new Promise((resolve, reject) => {
        const db = require('../config/database');
        
        // Read SQL file
        const sqlContent = fs.readFileSync(filepath, 'utf8');
        
        // Split into individual statements (basic parser)
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        let executed = 0;
        
        function executeNext() {
            if (executed >= statements.length) {
                logger.info(`Executed ${executed} SQL statements`);
                return resolve();
            }

            const statement = statements[executed];
            executed++;

            // Skip comments and empty statements
            if (!statement || statement.startsWith('--') || statement.startsWith('/*')) {
                return executeNext();
            }

            db.query(statement, (err) => {
                if (err) {
                    // Log error but continue (some statements might fail on re-run)
                    logger.warn(`SQL statement warning (continuing): ${err.message}`);
                }
                executeNext();
            });
        }

        executeNext();
    });
}

// GET /api/backup/list - List available backups (optional)
router.get('/list', (req, res) => {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            return res.json({ backups: [] });
        }

        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.endsWith('.sql'))
            .map(file => {
                const filepath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filepath);
                return {
                    filename: file,
                    size: stats.size,
                    sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
                    created: stats.birthtime
                };
            })
            .sort((a, b) => b.created - a.created);

        res.json({ backups: files });

    } catch (error) {
        logger.error('Error listing backups:', error);
        res.status(500).json({ error: 'Failed to list backups', details: error.message });
    }
});

// DELETE /api/backup/:filename - Delete a backup file (optional)
router.delete('/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filepath = path.join(BACKUP_DIR, filename);

        // Security: ensure filename doesn't contain path traversal
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }

        fs.unlinkSync(filepath);
        logger.info(`Deleted backup file: ${filename}`);
        res.json({ message: 'Backup deleted successfully' });

    } catch (error) {
        logger.error('Error deleting backup:', error);
        res.status(500).json({ error: 'Failed to delete backup', details: error.message });
    }
});

module.exports = router;
