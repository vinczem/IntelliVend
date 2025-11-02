const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class EmailService {
    constructor() {
        // Create transporter
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });

        // Verify connection
        this.verifyConnection();
    }

    async verifyConnection() {
        try {
            await this.transporter.verify();
            logger.info('📧 Email service ready');
        } catch (error) {
            logger.error('❌ Email service error:', error.message);
        }
    }

    /**
     * Send low stock alert email
     */
    async sendLowStockAlert(alert) {
        const subject = `⚠️ IntelliVend - Alacsony készlet riasztás`;
        const html = this.getLowStockEmailTemplate(alert);

        return this.sendEmail(subject, html);
    }

    /**
     * Send empty bottle alert email
     */
    async sendEmptyBottleAlert(alert) {
        const subject = `🔴 IntelliVend - Üres palack riasztás`;
        const html = this.getEmptyBottleEmailTemplate(alert);

        return this.sendEmail(subject, html);
    }

    /**
     * Send critical alert summary (multiple alerts)
     */
    async sendAlertSummary(alerts) {
        const subject = `🚨 IntelliVend - Riasztás összefoglaló (${alerts.length} db)`;
        const html = this.getAlertSummaryTemplate(alerts);

        return this.sendEmail(subject, html);
    }

    /**
     * Generic email sender
     */
    async sendEmail(subject, html) {
        try {
            const mailOptions = {
                from: `"IntelliVend System" <${process.env.SMTP_USER}>`,
                to: process.env.ALERT_EMAIL,
                subject: subject,
                html: html
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`📧 Email sent: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error('❌ Email send error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Low stock email template
     */
    getLowStockEmailTemplate(alert) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #ffa502, #ff6348);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .alert-box {
            background: white;
            border-left: 4px solid #ffa502;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .alert-icon {
            font-size: 48px;
            text-align: center;
            margin-bottom: 10px;
        }
        .alert-title {
            font-size: 20px;
            font-weight: bold;
            color: #ffa502;
            margin-bottom: 10px;
        }
        .alert-details {
            background: #fff3cd;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: bold;
            color: #666;
        }
        .value {
            color: #333;
        }
        .action-button {
            display: inline-block;
            background: #2196F3;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚠️ Alacsony készlet riasztás</h1>
    </div>
    <div class="content">
        <div class="alert-box">
            <div class="alert-icon">⚠️</div>
            <div class="alert-title">${alert.message}</div>
            
            <div class="alert-details">
                <div class="detail-row">
                    <span class="label">Alapanyag:</span>
                    <span class="value">${alert.ingredient_name}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Pumpa:</span>
                    <span class="value">#${alert.pump_number}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Súlyosság:</span>
                    <span class="value" style="color: #ffa502; font-weight: bold;">FIGYELMEZTETÉS</span>
                </div>
                <div class="detail-row">
                    <span class="label">Időpont:</span>
                    <span class="value">${new Date(alert.created_at).toLocaleString('hu-HU')}</span>
                </div>
            </div>
            
            <p>Töltsd fel az alapanyagot a készlet kimerülése előtt!</p>
            
            <center>
                <a href="${process.env.FRONTEND_URL}" class="action-button">
                    🔗 IntelliVend megnyitása
                </a>
            </center>
        </div>
    </div>
    <div class="footer">
        <p>Ez egy automatikus riasztás az IntelliVend rendszerből.</p>
        <p>IntelliVend - Intelligent Vending Machine System</p>
    </div>
</body>
</html>
        `;
    }

    /**
     * Empty bottle email template
     */
    getEmptyBottleEmailTemplate(alert) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #ff4757, #ff6348);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .alert-box {
            background: white;
            border-left: 4px solid #ff4757;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .alert-icon {
            font-size: 48px;
            text-align: center;
            margin-bottom: 10px;
        }
        .alert-title {
            font-size: 20px;
            font-weight: bold;
            color: #ff4757;
            margin-bottom: 10px;
        }
        .alert-details {
            background: #ffe0e0;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: bold;
            color: #666;
        }
        .value {
            color: #333;
        }
        .action-button {
            display: inline-block;
            background: #2196F3;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: bold;
        }
        .urgent {
            background: #ff4757;
            color: white;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            font-weight: bold;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔴 KRITIKUS: Üres palack!</h1>
    </div>
    <div class="content">
        <div class="alert-box">
            <div class="alert-icon">🔴</div>
            <div class="alert-title">${alert.message}</div>
            
            <div class="urgent">
                ⚠️ AZONNALI BEAVATKOZÁS SZÜKSÉGES! ⚠️
            </div>
            
            <div class="alert-details">
                <div class="detail-row">
                    <span class="label">Alapanyag:</span>
                    <span class="value">${alert.ingredient_name}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Pumpa:</span>
                    <span class="value">#${alert.pump_number}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Súlyosság:</span>
                    <span class="value" style="color: #ff4757; font-weight: bold;">KRITIKUS</span>
                </div>
                <div class="detail-row">
                    <span class="label">Időpont:</span>
                    <span class="value">${new Date(alert.created_at).toLocaleString('hu-HU')}</span>
                </div>
            </div>
            
            <p><strong>⚠️ Azonnali művelet:</strong> A palack teljesen üres! Töltsd fel azonnal, hogy a rendszer továbbra is működhessen.</p>
            
            <center>
                <a href="${process.env.FRONTEND_URL}" class="action-button">
                    🔗 IntelliVend megnyitása
                </a>
            </center>
        </div>
    </div>
    <div class="footer">
        <p>Ez egy automatikus kritikus riasztás az IntelliVend rendszerből.</p>
        <p>IntelliVend - Intelligent Vending Machine System</p>
    </div>
</body>
</html>
        `;
    }

    /**
     * Alert summary email template (multiple alerts)
     */
    getAlertSummaryTemplate(alerts) {
        const criticalCount = alerts.filter(a => a.severity === 'critical').length;
        const warningCount = alerts.filter(a => a.severity === 'warning').length;

        const alertRows = alerts.map(alert => `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 12px; text-align: center;">
                    ${alert.severity === 'critical' ? '🔴' : '⚠️'}
                </td>
                <td style="padding: 12px;">${alert.ingredient_name}</td>
                <td style="padding: 12px; text-align: center;">#${alert.pump_number}</td>
                <td style="padding: 12px;">
                    <span style="color: ${alert.severity === 'critical' ? '#ff4757' : '#ffa502'}; font-weight: bold;">
                        ${alert.severity.toUpperCase()}
                    </span>
                </td>
                <td style="padding: 12px; font-size: 12px;">
                    ${new Date(alert.created_at).toLocaleString('hu-HU')}
                </td>
            </tr>
        `).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #ff4757, #ffa502);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }
        .summary {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            flex: 1;
            margin: 0 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .summary-number {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }
        .critical { color: #ff4757; }
        .warning { color: #ffa502; }
        table {
            width: 100%;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin: 20px 0;
        }
        th {
            background: #2196F3;
            color: white;
            padding: 15px;
            text-align: left;
        }
        .action-button {
            display: inline-block;
            background: #2196F3;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚨 Riasztás összefoglaló</h1>
        <p style="margin: 10px 0 0 0;">IntelliVend rendszer - ${alerts.length} aktív riasztás</p>
    </div>
    <div class="content">
        <div class="summary">
            <div class="summary-card">
                <div>🔴 Kritikus</div>
                <div class="summary-number critical">${criticalCount}</div>
            </div>
            <div class="summary-card">
                <div>⚠️ Figyelmeztetés</div>
                <div class="summary-number warning">${warningCount}</div>
            </div>
            <div class="summary-card">
                <div>📊 Összesen</div>
                <div class="summary-number">${alerts.length}</div>
            </div>
        </div>

        <h3>Részletes riasztások:</h3>
        <table>
            <thead>
                <tr>
                    <th style="text-align: center;">Típus</th>
                    <th>Alapanyag</th>
                    <th style="text-align: center;">Pumpa</th>
                    <th>Súlyosság</th>
                    <th>Időpont</th>
                </tr>
            </thead>
            <tbody>
                ${alertRows}
            </tbody>
        </table>

        <p style="margin-top: 30px;"><strong>Javasolt művelet:</strong> Ellenőrizd a készleteket és töltsd fel az üres/alacsony palackokat.</p>
        
        <center>
            <a href="${process.env.FRONTEND_URL}" class="action-button">
                🔗 IntelliVend megnyitása
            </a>
        </center>
    </div>
    <div class="footer">
        <p>Ez egy automatikus összefoglaló email az IntelliVend rendszerből.</p>
        <p>IntelliVend - Intelligent Vending Machine System</p>
    </div>
</body>
</html>
        `;
    }
}

module.exports = new EmailService();
