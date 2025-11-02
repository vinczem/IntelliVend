const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const db = require('../config/database');

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
