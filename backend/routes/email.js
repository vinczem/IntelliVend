const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const db = require('../config/database');

/**
 * @swagger
 * /api/email/test:
 *   post:
 *     summary: Teszt email küldése
 *     description: Teszt email küldése az email szolgáltatás működésének ellenőrzésére
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Email sikeresen elküldve
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 success:
 *                   type: boolean
 *                 messageId:
 *                   type: string
 *       500:
 *         description: Email küldési hiba
 */
// POST /api/email/test - Send test email
router.post('/test', async (req, res) => {
    try {
        const testAlert = {
            id: 999,
            message: 'Test riasztás - Ez egy teszt email',
            severity: 'warning',
            type: 'low_stock',
            ingredient_name: 'Vodka',
            pump_number: 1,
            created_at: new Date()
        };

        const result = await emailService.sendLowStockAlert(testAlert);
        
        res.json({
            message: 'Test email sent',
            success: result.success,
            messageId: result.messageId,
            error: result.error
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/email/notifications:
 *   get:
 *     summary: Email értesítések előzményei
 *     description: Elküldött email értesítések listája
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   alert_id:
 *                     type: integer
 *                   email_to:
 *                     type: string
 *                   sent_at:
 *                     type: string
 *                     format: date-time
 *                   alert_message:
 *                     type: string
 *                   severity:
 *                     type: string
 *       500:
 *         description: Adatbázis hiba
 */
// GET /api/email/notifications - Get email notification history
router.get('/notifications', (req, res) => {
    const query = `
        SELECT en.*, a.message as alert_message, a.severity
        FROM email_notifications en
        LEFT JOIN alerts a ON en.alert_id = a.id
        ORDER BY en.sent_at DESC
        LIMIT 50
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }
        res.json(results);
    });
});

/**
 * @swagger
 * /api/email/config:
 *   get:
 *     summary: Email konfiguráció állapota
 *     description: SMTP konfiguráció állapotának lekérése (jelszavak rejtve)
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Sikeres lekérdezés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 smtp_host:
 *                   type: string
 *                 smtp_port:
 *                   type: string
 *                 smtp_user:
 *                   type: string
 *                   description: Felhasználónév vagy '***configured***'
 *                 smtp_password:
 *                   type: string
 *                   description: Mindig rejtve vagy 'not configured'
 *                 alert_email:
 *                   type: string
 *                 service_ready:
 *                   type: boolean
 *                   description: Email szolgáltatás használatra kész-e
 */
// GET /api/email/config - Get email configuration status
router.get('/config', (req, res) => {
    const config = {
        smtp_host: process.env.SMTP_HOST,
        smtp_port: process.env.SMTP_PORT,
        smtp_user: process.env.SMTP_USER ? '***configured***' : 'not configured',
        smtp_password: process.env.SMTP_PASSWORD ? '***configured***' : 'not configured',
        alert_email: process.env.ALERT_EMAIL,
        service_ready: !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.ALERT_EMAIL)
    };
    
    res.json(config);
});

module.exports = router;
