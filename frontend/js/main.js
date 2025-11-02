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
    loadDrinks();
    checkAlerts();
    
    // Refresh alerts every 30 seconds
    setInterval(checkAlerts, 30000);
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
            // Show all unresolved alerts
            alerts.forEach(alert => {
                const alertType = alert.severity === 'critical' ? 'error' : 'warning';
                UI.showAlert(`⚠️ ${alert.message}`, alertType);
            });
        }
    } catch (error) {
        console.error('Error checking alerts:', error);
    }
}
