// Main application logic
let currentFilters = {
    available_only: 'true',
    category: '',
    is_alcoholic: ''
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeNavigation();
    initializeFilters();
    initializeModal();
    initializeAlertPanel();
    initializeWebSocketHandlers();
    loadDrinks();
    checkAlerts();
    loadAlertPanel();
    
    // Refresh alerts every 30 seconds
    setInterval(() => {
        checkAlerts();
        loadAlertPanel();
    }, 30000);
});

function initializeTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');
    
    // Check saved theme preference or default to light mode
    const currentTheme = localStorage.getItem('theme') || 'light';
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.textContent = '☀️';
    }
    
    // Toggle theme
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        
        // Update icon
        themeIcon.textContent = isDark ? '☀️' : '🌙';
        
        // Save preference
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}

function initializeNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            UI.showView(view);
            
            // Load data for the view
            switch(view) {
                case 'drinks':
                    loadDrinks();
                    break;
                case 'admin':
                    loadAdminData();
                    break;
                case 'inventory':
                    loadInventory();
                    break;
                case 'stats':
                    loadStats();
                    break;
            }
        });
    });
}

function initializeFilters() {
    document.getElementById('filter-available').addEventListener('change', (e) => {
        currentFilters.available_only = e.target.checked ? 'true' : 'false';
        loadDrinks();
    });
    
    document.getElementById('filter-category').addEventListener('change', (e) => {
        currentFilters.category = e.target.value;
        loadDrinks();
    });
    
    document.getElementById('filter-alcoholic').addEventListener('change', (e) => {
        currentFilters.is_alcoholic = e.target.value;
        loadDrinks();
    });
}

function initializeModal() {
    const modal = document.getElementById('dispense-modal');
    const closeBtn = modal.querySelector('.close');
    
    closeBtn.addEventListener('click', () => {
        UI.hideModal('dispense-modal');
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            UI.hideModal('dispense-modal');
        }
    });
}

async function loadDrinks() {
    try {
        UI.showLoading('drinks-grid', 'Italok betöltése...');
        const drinks = await API.getRecipes(currentFilters);
        UI.renderDrinks(drinks);
    } catch (error) {
        UI.showAlert('Hiba az italok betöltésekor: ' + error.message, 'error');
        UI.showEmptyState('drinks-grid', {
            icon: '❌',
            title: 'Hiba történt',
            message: 'Nem sikerült betölteni az italokat. ' + error.message
        });
    }
}

async function loadInventory() {
    try {
        UI.showLoading('inventory-list', 'Készlet adatok betöltése...');
        const inventory = await API.getInventory();
        UI.renderInventory(inventory);
        
        // Attach bulk refill button handler
        const bulkRefillBtn = document.getElementById('btn-bulk-refill');
        if (bulkRefillBtn) {
            bulkRefillBtn.onclick = async () => {
                if (confirm('Biztosan újratöltöttél MINDEN üveget? Ez az összes készletet maximumra állítja!')) {
                    try {
                        const result = await API.refillAllBottles();
                        UI.showAlert(`✅ ${result.refilled_count} pumpa újratöltve!`, 'success');
                        loadInventory(); // Refresh
                    } catch (error) {
                        UI.showAlert('Hiba a tömeges újratöltéskor: ' + error.message, 'error');
                    }
                }
            };
        }
    } catch (error) {
        UI.showAlert('Hiba a készlet betöltésekor: ' + error.message, 'error');
    }
}

async function loadStats() {
    // Get selected period
    const periodSelector = document.getElementById('stats-period');
    const days = periodSelector ? parseInt(periodSelector.value) : 30;
    
    // Render stats with selected period
    UI.renderStats(days);
    
    // Add change event listener if not already added
    if (periodSelector && !periodSelector.dataset.listenerAdded) {
        periodSelector.addEventListener('change', () => {
            const newDays = parseInt(periodSelector.value);
            UI.renderStats(newDays);
        });
        periodSelector.dataset.listenerAdded = 'true';
    }
}

async function loadAdminData() {
    // Initialize admin tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            UI.showAdminTab(btn.dataset.tab);
        });
    });
    
    // Load default tab (ingredients)
    UI.showAdminTab('ingredients');
}

async function checkAlerts() {
    try {
        const alerts = await API.getAlerts({ is_resolved: 'false' });
        
        if (alerts.length > 0) {
            // Get seen alerts from LocalStorage
            const seenAlerts = getSeenAlerts();
            
            // Show only new or updated alerts
            alerts.forEach(alert => {
                const alertKey = `${alert.id}-${alert.created_at}`;
                
                // Check if this exact alert (ID + timestamp) has been seen
                if (!seenAlerts.includes(alertKey)) {
                    const alertType = alert.severity === 'critical' ? 'error' : 'warning';
                    UI.showAlert(`⚠️ ${alert.message}`, alertType);
                    
                    // Mark as seen
                    markAlertAsSeen(alertKey);
                }
            });
        }
    } catch (error) {
        console.error('Error checking alerts:', error);
    }
}

// LocalStorage helpers for alert tracking
function getSeenAlerts() {
    try {
        const seen = localStorage.getItem('intellivend_seen_alerts');
        return seen ? JSON.parse(seen) : [];
    } catch (error) {
        console.error('Error reading seen alerts:', error);
        return [];
    }
}

function markAlertAsSeen(alertKey) {
    try {
        const seen = getSeenAlerts();
        
        // Add to seen list if not already there
        if (!seen.includes(alertKey)) {
            seen.push(alertKey);
            
            // Keep only last 100 seen alerts to prevent LocalStorage bloat
            if (seen.length > 100) {
                seen.shift();
            }
            
            localStorage.setItem('intellivend_seen_alerts', JSON.stringify(seen));
        }
    } catch (error) {
        console.error('Error marking alert as seen:', error);
    }
}

function clearSeenAlerts() {
    try {
        localStorage.removeItem('intellivend_seen_alerts');
        console.log('✅ Seen alerts cleared');
    } catch (error) {
        console.error('Error clearing seen alerts:', error);
    }
}

// Alert Panel Functions
function initializeAlertPanel() {
    const alertToggle = document.getElementById('alert-toggle');
    const alertPanel = document.getElementById('alert-panel');
    const alertPanelClose = document.getElementById('alert-panel-close');
    
    // Toggle panel on icon click
    alertToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        alertPanel.classList.toggle('hidden');
        
        // Load alerts when opening
        if (!alertPanel.classList.contains('hidden')) {
            loadAlertPanel();
        }
    });
    
    // Close panel on close button click
    alertPanelClose.addEventListener('click', () => {
        alertPanel.classList.add('hidden');
    });
    
    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!alertPanel.contains(e.target) && !alertToggle.contains(e.target)) {
            alertPanel.classList.add('hidden');
        }
    });
}

async function loadAlertPanel() {
    try {
        const alerts = await API.getAlerts({ is_resolved: 'false' });
        const alertBadge = document.getElementById('alert-badge');
        const alertPanelContent = document.getElementById('alert-panel-content');
        
        // Update badge
        if (alerts.length > 0) {
            alertBadge.textContent = alerts.length;
            alertBadge.classList.remove('hidden');
        } else {
            alertBadge.classList.add('hidden');
        }
        
        // Render alerts
        if (alerts.length === 0) {
            alertPanelContent.innerHTML = `
                <div class="alert-panel-empty">
                    <div class="alert-panel-empty-icon">✅</div>
                    <div class="alert-panel-empty-text">Nincsenek aktív riasztások</div>
                </div>
            `;
        } else {
            alertPanelContent.innerHTML = alerts.map(alert => `
                <div class="alert-card ${alert.severity}">
                    <div class="alert-card-header">
                        <span class="alert-card-severity ${alert.severity}">
                            ${alert.severity === 'critical' ? '🔴 Kritikus' : '⚠️ Figyelmeztetés'}
                        </span>
                    </div>
                    <div class="alert-card-message">${alert.message}</div>
                    <div class="alert-card-time">
                        ${new Date(alert.created_at).toLocaleString('hu-HU')}
                    </div>
                    <div class="alert-card-actions">
                        <button class="alert-dismiss-btn" onclick="dismissAlert(${alert.id})">
                            Elutasítás
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading alert panel:', error);
        UI.showAlert('Hiba a riasztások betöltése során', 'error');
    }
}

async function dismissAlert(alertId) {
    try {
        await API.resolveAlert(alertId);
        UI.showAlert('Riasztás elutasítva', 'success');
        loadAlertPanel(); // Reload panel
    } catch (error) {
        console.error('Error dismissing alert:', error);
        UI.showAlert('Hiba a riasztás elutasítása során', 'error');
    }
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('✅ PWA Service Worker registered:', registration.scope);
            })
            .catch(error => {
                console.log('❌ PWA Service Worker registration failed:', error);
            });
    });
}

// WebSocket Event Handlers
function initializeWebSocketHandlers() {
    // Listen for dispense status updates
    wsClient.on('dispense:status', (data) => {
        // Show progress container
        const progressContainer = document.getElementById('dispense-progress');
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
        }
        
        // Update progress bar
        const progressFill = document.querySelector('#dispense-progress .progress-fill');
        if (progressFill && data.target_ml > 0) {
            const progress = (data.progress_ml / data.target_ml) * 100;
            progressFill.style.width = `${Math.min(progress, 100)}%`;
        }
        
        // Update status text
        const statusText = document.getElementById('dispense-status');
        if (statusText) {
            statusText.textContent = `Adagolás: ${data.progress_ml.toFixed(1)}ml / ${data.target_ml}ml (${data.flow_rate_ml_s.toFixed(1)} ml/s)`;
        }
        
        // Hide dispense button during dispensing
        const dispenseBtn = document.getElementById('btn-dispense');
        if (dispenseBtn) {
            dispenseBtn.disabled = true;
            dispenseBtn.textContent = 'Adagolás folyamatban...';
        }
    });
    
    // Show alert on completion
    wsClient.on('dispense:complete', (data) => {
        // Clear timeout if active
        if (window.dispenseTimeoutId) {
            clearTimeout(window.dispenseTimeoutId);
            window.dispenseTimeoutId = null;
        }
        
        // Hide progress container
        const progressContainer = document.getElementById('dispense-progress');
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
        
        // Reset progress bar
        const progressFill = document.querySelector('#dispense-progress .progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }
        
        // Re-enable dispense button
        const dispenseBtn = document.getElementById('btn-dispense');
        if (dispenseBtn) {
            dispenseBtn.disabled = false;
            dispenseBtn.textContent = 'Kérek egy ilyet!';
        }
        
        // Close modal after short delay
        setTimeout(() => {
            if (typeof UI !== 'undefined' && UI.hideModal) {
                UI.hideModal('dispense-modal');
            }
            
            // Reload drinks to update availability
            if (typeof loadDrinks === 'function') {
                loadDrinks();
            }
        }, 1500);
        
        // Show success alert
        if (typeof UI !== 'undefined' && UI.showAlert) {
            UI.showAlert(`Adagolás sikeres: ${data.actual_ml}ml`, 'success');
        }
    });
    
    // Show alert on maintenance complete
    wsClient.on('maintenance:complete', (data) => {
        if (typeof UI !== 'undefined' && UI.showAlert) {
            UI.showAlert(`Karbantartás befejezve: ${data.pump_id}. pumpa`, 'success');
        }
        
        // Refresh maintenance history if on maintenance page
        if (typeof loadMaintenanceHistory === 'function') {
            loadMaintenanceHistory();
        }
    });
    
    // Show error notifications
    wsClient.on('esp32:error', (data) => {
        // Clear timeout if active
        if (window.dispenseTimeoutId) {
            clearTimeout(window.dispenseTimeoutId);
            window.dispenseTimeoutId = null;
        }
        
        // Hide progress and re-enable button
        const progressContainer = document.getElementById('dispense-progress');
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
        
        const dispenseBtn = document.getElementById('btn-dispense');
        if (dispenseBtn) {
            dispenseBtn.disabled = false;
            dispenseBtn.textContent = 'Kérek egy ilyet!';
        }
        
        if (typeof UI !== 'undefined' && UI.showAlert) {
            UI.showAlert(`${data.message}`, 'error');
        }
    });
    
    // Update ESP32 status indicator
    let lastHeartbeat = Date.now();
    wsClient.on('esp32:heartbeat', (data) => {
        lastHeartbeat = Date.now();
        
        const esp32Status = document.getElementById('esp32-status');
        if (esp32Status) {
            // WiFi signal strength icons
            let wifiIcon = '📶';
            if (data.wifi_rssi < -80) wifiIcon = '📵'; // Weak signal
            else if (data.wifi_rssi < -70) wifiIcon = '📶'; // Medium signal
            else wifiIcon = '📡'; // Strong signal
            
            // Memory warning
            const memoryIcon = data.memory_used_percent > 80 ? '⚠️' : '';
            
            esp32Status.innerHTML = `
                <span class="status-dot status-online"></span>
                ESP32: Online ${wifiIcon} ${data.wifi_rssi}dBm ${memoryIcon}
            `;
            esp32Status.classList.add('online');
            esp32Status.classList.remove('offline');
        }
    });
    
    // Check for ESP32 offline (no heartbeat for 30 seconds)
    setInterval(() => {
        if (Date.now() - lastHeartbeat > 30000) {
            const esp32Status = document.getElementById('esp32-status');
            if (esp32Status) {
                esp32Status.innerHTML = '<span class="status-dot status-offline"></span> ESP32: Offline';
                esp32Status.classList.add('offline');
                esp32Status.classList.remove('online');
            }
        }
    }, 5000);
}
