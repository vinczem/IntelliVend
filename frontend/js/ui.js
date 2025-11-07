// UI Helper Functions
const UI = {
    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show selected view
        const view = document.getElementById(`${viewName}-view`);
        if (view) {
            view.classList.add('active');
        }
        
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const navBtn = document.querySelector(`[data-view="${viewName}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        }
    },

    showAlert(message, type = 'info') {
        const container = document.getElementById('alerts-container');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        
        // Icon mapping
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        
        // Build alert structure
        alert.innerHTML = `
            <div class="alert-icon">${icons[type] || icons.info}</div>
            <div class="alert-content">${message}</div>
            <button class="alert-close" aria-label="Close">×</button>
            <div class="alert-progress"></div>
        `;
        
        // Close button functionality
        const closeBtn = alert.querySelector('.alert-close');
        closeBtn.addEventListener('click', () => {
            alert.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => alert.remove(), 300);
        });
        
        container.appendChild(alert);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => alert.remove(), 300);
            }
        }, 5000);
    },

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    },

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    },

    showLoading(container, message = 'Betöltés...') {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        if (!container) return;
        
        container.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
    },

    showEmptyState(container, options = {}) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        if (!container) return;
        
        const {
            icon = '📭',
            title = 'Nincs megjeleníthető adat',
            message = 'Jelenleg nincsenek elérhető elemek.',
            actionText = null,
            actionCallback = null
        } = options;
        
        let actionButton = '';
        if (actionText && actionCallback) {
            actionButton = `<button class="empty-state-action" onclick="(${actionCallback.toString()})()">${actionText}</button>`;
        }
        
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${icon}</div>
                <div class="empty-state-title">${title}</div>
                <div class="empty-state-message">${message}</div>
                ${actionButton}
            </div>
        `;
    },

    renderDrinks(drinks) {
        const grid = document.getElementById('drinks-grid');
        
        if (drinks.length === 0) {
            this.showEmptyState(grid, {
                icon: '🍹',
                title: 'Nincs elérhető ital',
                message: 'Jelenleg nincsenek megjeleníthető italok. Kérjük, próbálja újra később vagy vegye fel a kapcsolatot az adminisztrátorral.'
            });
            return;
        }
        
        grid.innerHTML = '';
        drinks.forEach(drink => {
            const card = document.createElement('div');
            card.className = 'drink-card';
            card.innerHTML = `
                <div class="drink-image">
                    ${drink.image_url ? 
                        `<img src="${API.staticURL}${drink.image_url}" alt="${drink.name}">` : 
                        '<div class="placeholder-image">🍹</div>'}
                </div>
                <h3>${drink.name}</h3>
                <p class="drink-description">${drink.description || ''}</p>
                <div class="drink-meta">
                    <span class="badge badge-${drink.category}">${drink.category}</span>
                    <span class="badge badge-${drink.is_alcoholic ? 'alcoholic' : 'non-alcoholic'}">
                        ${drink.is_alcoholic ? 'Alkoholos' : 'Alkoholmentes'}
                    </span>
                </div>
                <p class="drink-ingredients">${drink.ingredients_list || 'Hozzávalók betöltése...'}</p>
                <button class="btn-select" data-recipe-id="${drink.id}">Ezt választom</button>
            `;
            
            card.querySelector('.btn-select').addEventListener('click', () => {
                this.showDrinkDetails(drink.id);
            });
            
            grid.appendChild(card);
        });
    },

    async showDrinkDetails(recipeId) {
        try {
            const recipe = await API.getRecipe(recipeId);
            
            document.getElementById('modal-drink-name').textContent = recipe.name;
            
            const detailsHtml = `
                <p>${recipe.description || ''}</p>
                <h4>Hozzávalók:</h4>
                <ul>
                    ${recipe.ingredients.map(ing => `
                        <li>
                            ${ing.name}: ${ing.quantity} ${ing.unit}
                            ${parseFloat(ing.current_quantity || 0) < parseFloat(ing.quantity) ? ' ⚠️ <span class="warning">Nincs elegendő</span>' : ''}
                        </li>
                    `).join('')}
                </ul>
                <p><strong>Teljes mennyiség:</strong> ${recipe.total_volume_ml} ml</p>
                <p><strong>Pohár:</strong> ${recipe.glass_type || 'N/A'}</p>
                ${recipe.instructions ? `<p><strong>Utasítások:</strong> ${recipe.instructions}</p>` : ''}
            `;
            
            document.getElementById('modal-drink-details').innerHTML = detailsHtml;
            
            // Check if recipe has alcoholic ingredients
            const hasAlcohol = recipe.ingredients.some(ing => parseFloat(ing.alcohol_percentage || 0) > 0);
            const strengthSelector = document.getElementById('strength-selector');
            
            if (hasAlcohol) {
                strengthSelector.classList.remove('hidden');
                // Reset to default (normal)
                document.querySelectorAll('.strength-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.strength === 'normal') {
                        btn.classList.add('active');
                    }
                });
                
                // Add click handlers to strength buttons
                document.querySelectorAll('.strength-btn').forEach(btn => {
                    btn.onclick = () => {
                        document.querySelectorAll('.strength-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    };
                });
            } else {
                strengthSelector.classList.add('hidden');
            }
            
            const dispenseBtn = document.getElementById('btn-dispense');
            dispenseBtn.disabled = !recipe.is_available;
            dispenseBtn.textContent = recipe.is_available ? 'Kérek egy ilyet!' : 'Nem elérhető';
            
            dispenseBtn.onclick = () => this.dispenseDrink(recipeId);
            
            this.showModal('dispense-modal');
        } catch (error) {
            this.showAlert('Hiba a recept betöltésekor: ' + error.message, 'error');
        }
    },

    async dispenseDrink(recipeId) {
        const progressDiv = document.getElementById('dispense-progress');
        const statusText = document.getElementById('dispense-status');
        const dispenseBtn = document.getElementById('btn-dispense');
        
        // Timeout for dispense operation (60 seconds)
        let timeoutId = null;
        let logId = null;
        
        try {
            // Get selected strength
            const strengthSelector = document.getElementById('strength-selector');
            let strength = 'normal';
            if (!strengthSelector.classList.contains('hidden')) {
                const activeBtn = document.querySelector('.strength-btn.active');
                strength = activeBtn ? activeBtn.dataset.strength : 'normal';
            }
            
            dispenseBtn.disabled = true;
            progressDiv.classList.remove('hidden');
            statusText.textContent = 'Készítés indítása...';
            
            const result = await API.dispenseDrink(recipeId, strength);
            logId = result.log_id; // Store log_id for timeout reporting
            
            statusText.textContent = 'Ital készítése folyamatban...';
            
            // Set timeout for dispense operation (60 seconds)
            const self = this; // Preserve 'this' context for timeout callback
            timeoutId = setTimeout(async () => {
                // Report timeout to backend (creates alert & sends email)
                if (logId) {
                    try {
                        await API.reportDispenseTimeout(logId);
                        console.log('✅ Timeout reported to backend, alert created');
                    } catch (error) {
                        console.error('❌ Failed to report timeout:', error);
                    }
                }
                
                // Close modal
                const modal = document.getElementById('dispense-modal');
                if (modal) {
                    modal.style.display = 'none';
                }
                
                // Show error
                self.showAlert('⏱️ Időtúllépés! Az ESP32 nem válaszol. Riasztás elküldve!', 'error');
                
                // Reset UI
                progressDiv.classList.add('hidden');
                dispenseBtn.disabled = false;
                
                // Clear the timeout ID
                window.dispenseTimeoutId = null;
            }, 60000); // 60 seconds timeout
            
            // Store timeout ID globally so websocket.js can clear it
            window.dispenseTimeoutId = timeoutId;
            
            // WebSocket will handle progress updates and completion
            // Modal will be closed by websocket.js when dispense:complete arrives
            
        } catch (error) {
            // Clear timeout on error
            if (timeoutId) {
                clearTimeout(timeoutId);
                window.dispenseTimeoutId = null;
            }
            
            this.showAlert('Hiba az ital készítésekor: ' + error.message, 'error');
            progressDiv.classList.add('hidden');
            dispenseBtn.disabled = false;
        }
    },

    renderInventory(inventory) {
        const list = document.getElementById('inventory-list');
        
        if (inventory.length === 0) {
            this.showEmptyState(list, {
                icon: '📦',
                title: 'Nincs készlet adat',
                message: 'Jelenleg nincsenek készlet adatok. Ellenőrizd, hogy a pumpák megfelelően vannak-e konfigurálva.'
            });
            return;
        }
        
        list.innerHTML = '';
        inventory.forEach(item => {
            const div = document.createElement('div');
            div.className = `inventory-item status-${item.status}`;
            div.innerHTML = `
                <div class="inventory-header">
                    <h3>Pumpa #${item.pump_number}: ${item.ingredient_name}</h3>
                    <span class="badge badge-${item.status}">${item.status}</span>
                </div>
                <div class="inventory-details">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${item.fill_percentage}%"></div>
                    </div>
                    <p>${item.current_quantity} / ${item.bottle_size} ml (${item.fill_percentage}%)</p>
                    <p class="inventory-meta">
                        <small>📦 Palack: ${item.bottle_size}ml | ⚠️ Alert: ${item.min_quantity_alert}ml</small>
                    </p>
                    ${item.status === 'empty' ? 
                        `<p class="warning">🚫 Üres! Töltsd újra az üveget!</p>` : 
                        item.status === 'low' || item.status === 'warning' ? 
                        `<p class="warning">⚠️ Alacsony készlet! Minimum: ${item.min_quantity_alert} ml</p>` : ''}
                </div>
                <div class="inventory-actions">
                    <button class="btn-refill" data-pump-id="${item.pump_id}" data-bottle-size="${item.bottle_size}">
                        🔄 Újratöltés
                    </button>
                    <button class="btn-settings" data-inventory='${JSON.stringify(item)}'>
                        ⚙️ Beállítások
                    </button>
                </div>
            `;
            
            div.querySelector('.btn-refill').addEventListener('click', (e) => {
                this.refillBottle(e.target.dataset.pumpId, e.target.dataset.bottleSize);
            });
            
            div.querySelector('.btn-settings').addEventListener('click', (e) => {
                const inventory = JSON.parse(e.target.dataset.inventory);
                this.showInventorySettings(inventory);
            });
            
            list.appendChild(div);
        });
    },

    async refillBottle(pumpId, bottleSize) {
        if (confirm('Biztosan újratöltötted ezt az üveget?')) {
            try {
                await API.refillBottle(pumpId, { bottle_size: parseFloat(bottleSize) });
                this.showAlert('Újratöltés rögzítve!', 'success');
                loadInventory();
            } catch (error) {
                this.showAlert('Hiba az újratöltéskor: ' + error.message, 'error');
            }
        }
    },

    async showInventorySettings(item) {
        const formHtml = `
            <div class="modal-overlay" id="inventory-settings-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>Pumpa #${item.pump_number} - Készlet beállítások</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <form id="inventory-settings-form" class="admin-form">
                        <div class="form-group">
                            <label>Alapanyag</label>
                            <input type="text" value="${item.ingredient_name}" disabled>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Palack méret (ml) *</label>
                                <input type="number" name="bottle_size" min="0" step="10" 
                                    value="${item.bottle_size}" required>
                                <small class="form-help">Teljes palack kapacitás</small>
                            </div>
                            
                            <div class="form-group">
                                <label>Minimum alert küszöb (ml) *</label>
                                <input type="number" name="min_quantity_alert" min="0" step="10" 
                                    value="${item.min_quantity_alert}" required>
                                <small class="form-help">Alert ennél az érték alatt</small>
                            </div>
                        </div>
                        
                        <div class="form-info">
                            <p>Az alert küszöböt állítsd be úgy, hogy legyen időd újratölteni 
                            mielőtt teljesen kifogyna az alapanyag.</p>
                            <p><strong>Jelenlegi készlet:</strong> ${item.current_quantity}ml</p>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary modal-close">Mégse</button>
                            <button type="submit" class="btn-primary">Mentés</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = formHtml;
        document.body.appendChild(modalContainer);

        const modal = document.getElementById('inventory-settings-modal');
        const closeButtons = modal.querySelectorAll('.modal-close');
        
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => modalContainer.remove());
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modalContainer.remove();
        });

        document.getElementById('inventory-settings-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = {
                bottle_size: parseFloat(formData.get('bottle_size')),
                min_quantity_alert: parseFloat(formData.get('min_quantity_alert'))
            };

            try {
                await API.updateInventorySettings(item.pump_id, data);
                this.showAlert('Beállítások mentve!', 'success');
                modalContainer.remove();
                loadInventory();
            } catch (error) {
                this.showAlert('Hiba: ' + error.message, 'error');
            }
        });
    },

    // Admin Panel
    showAdminTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabBtn) {
            tabBtn.classList.add('active');
        }

        // Load tab content
        const content = document.getElementById('admin-content');
        switch(tabName) {
            case 'ingredients':
                this.renderIngredientsAdmin(content);
                break;
            case 'pumps':
                this.renderPumpsAdmin(content);
                break;
            case 'recipes':
                this.renderRecipesAdmin(content);
                break;
            case 'maintenance':
                this.renderMaintenanceAdmin(content);
                break;
            case 'backup':
                this.renderBackupAdmin(content);
                break;
        }
    },

    async renderIngredientsAdmin(container) {
        // Show loading
        this.showLoading(container, 'Alapanyagok betöltése...');
        
        try {
            const ingredients = await API.getIngredients();
            
            // Check if empty
            if (ingredients.length === 0) {
                this.showEmptyState(container, {
                    icon: '🧪',
                    title: 'Nincsenek alapanyagok',
                    message: 'Adj hozzá egy új alapanyagot a kezdéshez!',
                    action: {
                        text: '+ Új alapanyag',
                        callback: () => this.showIngredientForm()
                    }
                });
                return;
            }
            
            container.innerHTML = `
                <div class="admin-header">
                    <h3>Alapanyag kezelés</h3>
                    <button class="btn-primary" id="btn-add-ingredient">+ Új alapanyag</button>
                </div>
                
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Név</th>
                            <th>Típus</th>
                            <th>Alkohol %</th>
                            <th>Költség/egység</th>
                            <th>Műveletek</th>
                        </tr>
                    </thead>
                    <tbody id="ingredients-tbody">
                        ${ingredients.map(ing => `
                            <tr data-id="${ing.id}">
                                <td>${ing.id}</td>
                                <td>${ing.name}</td>
                                <td><span class="badge badge-${ing.type}">${ing.type}</span></td>
                                <td>${parseFloat(ing.alcohol_percentage)}%</td>
                                <td>${parseFloat(ing.cost_per_unit)} Ft/ml</td>
                                <td class="action-buttons">
                                    <button class="btn-edit" data-id="${ing.id}">✏️ Szerkeszt</button>
                                    <button class="btn-delete" data-id="${ing.id}">🗑️ Töröl</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Event listeners
            document.getElementById('btn-add-ingredient').addEventListener('click', () => {
                this.showIngredientForm();
            });

            document.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    this.showIngredientForm(id);
                });
            });

            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    if (confirm('Biztosan törlöd ezt az alapanyagot?')) {
                        try {
                            await API.deleteIngredient(id);
                            this.showAlert('Alapanyag törölve!', 'success');
                            this.showAdminTab('ingredients');
                        } catch (error) {
                            this.showAlert('Hiba: ' + error.message, 'error');
                        }
                    }
                });
            });

        } catch (error) {
            this.showEmptyState(container, {
                icon: '❌',
                title: 'Hiba történt',
                message: error.message,
                action: {
                    text: '🔄 Újrapróbálás',
                    callback: () => this.showAdminTab('ingredients')
                }
            });
        }
    },

    async showIngredientForm(ingredientId = null) {
        const isEdit = ingredientId !== null;
        let ingredient = null;

        if (isEdit) {
            try {
                ingredient = await API.getIngredient(ingredientId);
            } catch (error) {
                this.showAlert('Hiba az alapanyag betöltésekor: ' + error.message, 'error');
                return;
            }
        }

        const formHtml = `
            <div class="modal-overlay" id="ingredient-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>${isEdit ? 'Alapanyag szerkesztése' : 'Új alapanyag'}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <form id="ingredient-form" class="admin-form">
                        <div class="form-group">
                            <label>Név *</label>
                            <input type="text" name="name" value="${ingredient?.name || ''}" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Leírás</label>
                            <textarea name="description" rows="3">${ingredient?.description || ''}</textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Típus *</label>
                                <select name="type" required>
                                    <option value="">Válassz...</option>
                                    <option value="alcohol" ${ingredient?.type === 'alcohol' ? 'selected' : ''}>Alkohol</option>
                                    <option value="non-alcohol" ${ingredient?.type === 'non-alcohol' ? 'selected' : ''}>Alkoholmentes</option>
                                    <option value="mixer" ${ingredient?.type === 'mixer' ? 'selected' : ''}>Mixer</option>
                                    <option value="syrup" ${ingredient?.type === 'syrup' ? 'selected' : ''}>Szirup</option>
                                    <option value="juice" ${ingredient?.type === 'juice' ? 'selected' : ''}>Gyümölcslé</option>
                                    <option value="other" ${ingredient?.type === 'other' ? 'selected' : ''}>Egyéb</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Alkohol % *</label>
                                <input type="number" name="alcohol_percentage" step="0.1" min="0" max="100" 
                                    value="${ingredient?.alcohol_percentage || 0}" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Egység</label>
                                <select name="unit">
                                    <option value="ml" ${ingredient?.unit === 'ml' ? 'selected' : ''}>ml</option>
                                    <option value="cl" ${ingredient?.unit === 'cl' ? 'selected' : ''}>cl</option>
                                    <option value="l" ${ingredient?.unit === 'l' ? 'selected' : ''}>l</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Költség/egység (Ft)</label>
                                <input type="number" name="cost_per_unit" step="0.01" min="0" 
                                    value="${ingredient?.cost_per_unit || 0}">
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary modal-close">Mégse</button>
                            <button type="submit" class="btn-primary">${isEdit ? 'Mentés' : 'Létrehozás'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Add to body
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = formHtml;
        document.body.appendChild(modalContainer);

        // Event listeners
        const modal = document.getElementById('ingredient-modal');
        const closeButtons = modal.querySelectorAll('.modal-close');
        
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modalContainer.remove();
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modalContainer.remove();
            }
        });

        // Form submit
        document.getElementById('ingredient-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            try {
                if (isEdit) {
                    await API.updateIngredient(ingredientId, data);
                    this.showAlert('Alapanyag frissítve!', 'success');
                } else {
                    await API.createIngredient(data);
                    this.showAlert('Alapanyag létrehozva!', 'success');
                }
                
                modalContainer.remove();
                this.showAdminTab('ingredients');
            } catch (error) {
                this.showAlert('Hiba: ' + error.message, 'error');
            }
        });
    },

    renderPumpsAdmin(container) {
        this.loadPumpsAdmin(container);
    },

    async loadPumpsAdmin(container) {
        // Show loading
        this.showLoading(container, 'Pumpák betöltése...');
        
        try {
            const [pumps, ingredients] = await Promise.all([
                API.getPumps(),
                API.getIngredients()
            ]);
            
            // Check if empty
            if (pumps.length === 0) {
                this.showEmptyState(container, {
                    icon: '⚙️',
                    title: 'Nincsenek pumpák',
                    message: 'A rendszerben nincs még pumpa konfigurálva.'
                });
                return;
            }
            
            container.innerHTML = `
                <div class="admin-header">
                    <h3>Pumpa kezelés</h3>
                </div>
                
                <table class="admin-table pumps-table">
                    <thead>
                        <tr>
                            <th>Pumpa #</th>
                            <th>Alapanyag</th>
                            <th>Készlet</th>
                            <th>Kalibráció</th>
                            <th>Állapot</th>
                            <th>Műveletek</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pumps.map(pump => `
                            <tr data-id="${pump.id}">
                                <td><strong>#${pump.pump_number}</strong></td>
                                <td>
                                    ${pump.ingredient_name 
                                        ? `<span class="badge badge-${pump.ingredient_type}">${pump.ingredient_name}</span>` 
                                        : '<span class="text-muted">Nincs hozzárendelve</span>'}
                                </td>
                                <td>
                                    ${pump.current_quantity 
                                        ? `${parseFloat(pump.current_quantity)} / ${parseFloat(pump.bottle_size)} ml` 
                                        : '-'}
                                </td>
                                <td>${parseFloat(pump.calibration_factor)}x</td>
                                <td>
                                    <span class="status-badge ${pump.is_active ? 'active' : 'inactive'}">
                                        ${pump.is_active ? '✓ Aktív' : '✗ Inaktív'}
                                    </span>
                                </td>
                                <td class="action-buttons">
                                    <button class="btn-assign" data-pump-id="${pump.id}">� Hozzárendel</button>
                                    <button class="btn-calibrate" data-pump-id="${pump.id}">⚙️ Kalibráció</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Event listeners
            document.querySelectorAll('.btn-assign').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const pumpId = e.target.dataset.pumpId;
                    const pump = pumps.find(p => p.id == pumpId);
                    this.showAssignPumpModal(pump, ingredients);
                });
            });

            document.querySelectorAll('.btn-calibrate').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const pumpId = e.target.dataset.pumpId;
                    const pump = pumps.find(p => p.id == pumpId);
                    this.showCalibratePumpModal(pump);
                });
            });

        } catch (error) {
            this.showEmptyState(container, {
                icon: '❌',
                title: 'Hiba történt',
                message: error.message,
                action: {
                    text: '🔄 Újrapróbálás',
                    callback: () => this.showAdminTab('pumps')
                }
            });
        }
    },

    async showAssignPumpModal(pump, ingredients) {
        const formHtml = `
            <div class="modal-overlay" id="assign-pump-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>Pumpa #${pump.pump_number} - Beállítások</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <form id="assign-pump-form" class="admin-form">
                        <div class="form-group">
                            <label>Válassz alapanyagot *</label>
                            <select name="ingredient_id" required>
                                <option value="">Válassz...</option>
                                ${ingredients.map(ing => `
                                    <option value="${ing.id}" ${pump.ingredient_id == ing.id ? 'selected' : ''}>
                                        ${ing.name} (${ing.type})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Palack méret (ml) *</label>
                                <input type="number" name="bottle_size" min="0" step="10" 
                                    value="${pump.bottle_size || 700}" required>
                            </div>
                            
                            <div class="form-group">
                                <label>Kezdő mennyiség (ml) *</label>
                                <input type="number" name="initial_quantity" min="0" step="10" 
                                    value="${pump.bottle_size || 700}" required>
                            </div>
                        </div>
                        
                        <div class="form-info">
                            <p><strong>Tipp:</strong> A kezdő mennyiség megegyezik a palack mérettel, 
                            kivéve ha a palack már részben üres.</p>
                        </div>
                        
                        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border-color);">
                        
                        <div class="form-group">
                            <label>Jegyzetek</label>
                            <textarea name="notes" rows="2" 
                                placeholder="Pl: Bal oldali felső pumpa, 6mm cső">${pump.notes || ''}</textarea>
                            <small style="color: var(--text-secondary); display: block; margin-top: 5px;">
                                💡 GPIO pin kiosztás az ESP32 firmware-ben van definiálva (IntelliVend_ESP32/config.h)
                            </small>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary modal-close">Mégse</button>
                            <button type="submit" class="btn-primary">Mentés</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = formHtml;
        document.body.appendChild(modalContainer);

        const modal = document.getElementById('assign-pump-modal');
        const closeButtons = modal.querySelectorAll('.modal-close');
        
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => modalContainer.remove());
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modalContainer.remove();
        });

        document.getElementById('assign-pump-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = {
                ingredient_id: parseInt(formData.get('ingredient_id')),
                bottle_size: parseFloat(formData.get('bottle_size')),
                initial_quantity: parseFloat(formData.get('initial_quantity')),
                notes: formData.get('notes')
            };

            try {
                await API.assignPump(pump.id, data);
                this.showAlert('Pumpa sikeresen hozzárendelve!', 'success');
                modalContainer.remove();
                this.showAdminTab('pumps'); // Reload
            } catch (error) {
                this.showAlert('Hiba: ' + error.message, 'error');
            }
        });
    },

    async showCalibratePumpModal(pump) {
        const formHtml = `
            <div class="modal-overlay" id="calibrate-pump-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>Pumpa #${pump.pump_number} - Kalibráció</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <form id="calibrate-pump-form" class="admin-form">
                        <div class="form-group">
                            <label>Jelenlegi alapanyag</label>
                            <input type="text" value="${pump.ingredient_name || 'Nincs'}" disabled>
                        </div>
                        
                        <div class="form-group">
                            <label>Kalibrációs faktor *</label>
                            <input type="number" name="calibration_factor" step="0.01" min="0.1" max="5" 
                                value="${parseFloat(pump.calibration_factor)}" required>
                            <small class="form-help">Alapértelmezett: 1.0. Növeld, ha kevesebb folyadékot ad ki, csökkentsd ha többet.</small>
                        </div>
                        
                        <div class="form-info">
                            <p>🔧 <strong>Kalibráció lépései:</strong></p>
                            <ol>
                                <li>Mérj ki 100ml folyadékot a pumpával</li>
                                <li>Ha kevesebbet mért (pl. 90ml), állítsd 1.1-re</li>
                                <li>Ha többet mért (pl. 110ml), állítsd 0.9-re</li>
                                <li>Ismételd meg amíg pontos nem lesz</li>
                            </ol>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary modal-close">Mégse</button>
                            <button type="submit" class="btn-primary">Kalibráció mentése</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = formHtml;
        document.body.appendChild(modalContainer);

        const modal = document.getElementById('calibrate-pump-modal');
        const closeButtons = modal.querySelectorAll('.modal-close');
        
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => modalContainer.remove());
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modalContainer.remove();
        });

        document.getElementById('calibrate-pump-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const calibrationFactor = parseFloat(formData.get('calibration_factor'));

            try {
                await API.calibratePump(pump.id, calibrationFactor);
                this.showAlert('Kalibráció mentve!', 'success');
                modalContainer.remove();
                this.showAdminTab('pumps'); // Reload
            } catch (error) {
                this.showAlert('Hiba: ' + error.message, 'error');
            }
        });
    },

    renderRecipesAdmin(container) {
        this.loadRecipesAdmin(container);
    },

    async loadRecipesAdmin(container) {
        // Show loading
        this.showLoading(container, 'Receptek betöltése...');
        
        try {
            const recipes = await API.getRecipes({});
            
            // Check if empty
            if (recipes.length === 0) {
                this.showEmptyState(container, {
                    icon: '📖',
                    title: 'Nincsenek receptek',
                    message: 'Hozz létre egy új receptet a kezdéshez!',
                    action: {
                        text: '+ Új recept',
                        callback: () => this.showRecipeForm()
                    }
                });
                return;
            }
            
            container.innerHTML = `
                <div class="admin-header">
                    <h3>Recept kezelés</h3>
                    <button class="btn-primary" id="btn-add-recipe">+ Új recept</button>
                </div>
                
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Név</th>
                            <th>Kategória</th>
                            <th>Alkoholos</th>
                            <th>Hozzávalók</th>
                            <th>Mennyiség</th>
                            <th>Aktív</th>
                            <th>Műveletek</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recipes.map(recipe => `
                            <tr data-id="${recipe.id}">
                                <td><strong>${recipe.name}</strong></td>
                                <td><span class="badge badge-${recipe.category}">${recipe.category}</span></td>
                                <td>${recipe.is_alcoholic ? '🍸 Igen' : '🥤 Nem'}</td>
                                <td><small>${recipe.ingredients_list || '-'}</small></td>
                                <td>${recipe.total_volume_ml} ml</td>
                                <td>
                                    <span class="status-badge ${recipe.is_active ? 'active' : 'inactive'}">
                                        ${recipe.is_active ? '✓' : '✗'}
                                    </span>
                                </td>
                                <td class="action-buttons">
                                    <button class="btn-edit" data-id="${recipe.id}">✏️ Szerkeszt</button>
                                    <button class="btn-delete" data-id="${recipe.id}">🗑️ Töröl</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Event listeners
            document.getElementById('btn-add-recipe').addEventListener('click', () => {
                this.showRecipeForm();
            });

            document.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.showRecipeForm(e.target.dataset.id);
                });
            });

            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    if (confirm('Biztosan törlöd ezt a receptet?')) {
                        try {
                            await API.deleteRecipe(id);
                            this.showAlert('Recept törölve!', 'success');
                            this.showAdminTab('recipes');
                        } catch (error) {
                            this.showAlert('Hiba: ' + error.message, 'error');
                        }
                    }
                });
            });

        } catch (error) {
            this.showEmptyState(container, {
                icon: '❌',
                title: 'Hiba történt',
                message: error.message,
                action: {
                    text: '🔄 Újrapróbálás',
                    callback: () => this.showAdminTab('recipes')
                }
            });
        }
    },

    async showRecipeForm(recipeId = null) {
        const isEdit = recipeId !== null;
        let recipe = null;
        let ingredients = [];

        try {
            ingredients = await API.getIngredients();
            
            if (isEdit) {
                recipe = await API.getRecipe(recipeId);
            }
        } catch (error) {
            this.showAlert('Hiba az adatok betöltésekor: ' + error.message, 'error');
            return;
        }

        const formHtml = `
            <div class="modal-overlay" id="recipe-modal">
                <div class="modal-dialog modal-wide">
                    <div class="modal-header">
                        <h3>${isEdit ? 'Recept szerkesztése' : 'Új recept'}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <form id="recipe-form" class="admin-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Név *</label>
                                <input type="text" name="name" value="${recipe?.name || ''}" required>
                            </div>
                            
                            <div class="form-group">
                                <label>Kategória *</label>
                                <select name="category" required>
                                    <option value="">Válassz...</option>
                                    <option value="cocktail" ${recipe?.category === 'cocktail' ? 'selected' : ''}>Cocktail</option>
                                    <option value="shot" ${recipe?.category === 'shot' ? 'selected' : ''}>Shot</option>
                                    <option value="long-drink" ${recipe?.category === 'long-drink' ? 'selected' : ''}>Long drink</option>
                                    <option value="mocktail" ${recipe?.category === 'mocktail' ? 'selected' : ''}>Mocktail</option>
                                    <option value="other" ${recipe?.category === 'other' ? 'selected' : ''}>Egyéb</option>
                                </select>
                            </div>
                        </div>
                        
                        ${isEdit ? `
                        <div class="form-group">
                            <label>Recept kép</label>
                            <div class="image-upload-container">
                                <div class="image-preview">
                                    ${recipe?.image_url ? 
                                        `<img src="${API.staticURL}${recipe.image_url}" alt="${recipe.name}" id="recipe-image-preview">` :
                                        `<div class="no-image-placeholder" id="recipe-image-preview">
                                            <span>🍹</span>
                                            <p>Nincs kép feltöltve</p>
                                        </div>`
                                    }
                                </div>
                                <div class="image-upload-actions">
                                    <input type="file" id="recipe-image-input" accept="image/*" style="display: none;">
                                    <button type="button" class="btn-secondary btn-sm" id="upload-image-btn">
                                        📸 Kép feltöltése
                                    </button>
                                    ${recipe?.image_url ? `
                                    <button type="button" class="btn-danger btn-sm" id="delete-image-btn">
                                        🗑️ Kép törlése
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="form-group">
                            <label>Leírás</label>
                            <textarea name="description" rows="2">${recipe?.description || ''}</textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Nehézség</label>
                                <select name="difficulty">
                                    <option value="easy" ${recipe?.difficulty === 'easy' ? 'selected' : ''}>Könnyű</option>
                                    <option value="medium" ${recipe?.difficulty === 'medium' ? 'selected' : ''}>Közepes</option>
                                    <option value="hard" ${recipe?.difficulty === 'hard' ? 'selected' : ''}>Nehéz</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Pohár típus</label>
                                <input type="text" name="glass_type" value="${recipe?.glass_type || ''}" placeholder="pl. Highball">
                            </div>
                            
                            <div class="form-group">
                                <label>Díszítés</label>
                                <input type="text" name="garnish" value="${recipe?.garnish || ''}" placeholder="pl. Citrom szelet">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" name="is_alcoholic" ${recipe?.is_alcoholic ? 'checked' : ''}>
                                Alkoholos ital
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>Utasítások</label>
                            <textarea name="instructions" rows="3">${recipe?.instructions || ''}</textarea>
                        </div>
                        
                        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border-color);">
                        
                        <div class="ingredients-section">
                            <div class="section-header">
                                <h4>Hozzávalók</h4>
                                <button type="button" class="btn-secondary btn-sm" id="add-ingredient-btn">+ Hozzávaló</button>
                            </div>
                            
                            <div id="ingredients-list">
                                ${recipe?.ingredients?.map((ing, idx) => this.renderIngredientRow(ingredients, ing, idx)).join('') || 
                                  this.renderIngredientRow(ingredients, null, 0)}
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary modal-close">Mégse</button>
                            <button type="submit" class="btn-primary">${isEdit ? 'Mentés' : 'Létrehozás'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = formHtml;
        document.body.appendChild(modalContainer);

        const modal = document.getElementById('recipe-modal');
        const closeButtons = modal.querySelectorAll('.modal-close');
        
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => modalContainer.remove());
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modalContainer.remove();
        });

        // Image upload handlers (only in edit mode)
        if (isEdit) {
            const imageInput = document.getElementById('recipe-image-input');
            const uploadBtn = document.getElementById('upload-image-btn');
            const deleteBtn = document.getElementById('delete-image-btn');
            
            if (uploadBtn) {
                uploadBtn.addEventListener('click', () => imageInput.click());
            }
            
            if (imageInput) {
                imageInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    // Validate file type
                    if (!file.type.startsWith('image/')) {
                        this.showAlert('Csak kép fájlokat lehet feltölteni!', 'error');
                        return;
                    }
                    
                    // Validate file size (5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        this.showAlert('A kép mérete maximum 5MB lehet!', 'error');
                        return;
                    }
                    
                    try {
                        uploadBtn.disabled = true;
                        uploadBtn.innerHTML = '<span class="btn-spinner"></span> Feltöltés...';
                        
                        const imageUrl = await API.uploadRecipeImage(recipeId, file);
                        
                        // Update preview
                        const preview = document.getElementById('recipe-image-preview');
                        if (preview.tagName === 'IMG') {
                            preview.src = API.staticURL + imageUrl;
                        } else {
                            preview.outerHTML = `<img src="${API.staticURL}${imageUrl}" alt="${recipe.name}" id="recipe-image-preview">`;
                        }
                        
                        // Add delete button if not exists
                        if (!deleteBtn) {
                            const actionsDiv = document.querySelector('.image-upload-actions');
                            actionsDiv.innerHTML += `
                                <button type="button" class="btn-danger btn-sm" id="delete-image-btn">
                                    🗑️ Kép törlése
                                </button>
                            `;
                            // Re-attach delete handler
                            document.getElementById('delete-image-btn').addEventListener('click', async () => {
                                if (!confirm('Biztosan törölni szeretnéd a képet?')) return;
                                
                                try {
                                    await API.deleteRecipeImage(recipeId);
                                    
                                    // Update preview to placeholder
                                    const preview = document.getElementById('recipe-image-preview');
                                    preview.outerHTML = `
                                        <div class="no-image-placeholder" id="recipe-image-preview">
                                            <span>🍹</span>
                                            <p>Nincs kép feltöltve</p>
                                        </div>
                                    `;
                                    
                                    // Remove delete button
                                    document.getElementById('delete-image-btn').remove();
                                    
                                    this.showAlert('Kép törölve!', 'success');
                                } catch (error) {
                                    this.showAlert('Hiba a kép törlésekor: ' + error.message, 'error');
                                }
                            });
                        }
                        
                        this.showAlert('Kép feltöltve!', 'success');
                    } catch (error) {
                        this.showAlert('Hiba a kép feltöltésekor: ' + error.message, 'error');
                    } finally {
                        uploadBtn.disabled = false;
                        uploadBtn.innerHTML = '📸 Kép feltöltése';
                        imageInput.value = ''; // Reset input
                    }
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    if (!confirm('Biztosan törölni szeretnéd a képet?')) return;
                    
                    try {
                        deleteBtn.disabled = true;
                        deleteBtn.innerHTML = '<span class="btn-spinner"></span> Törlés...';
                        
                        await API.deleteRecipeImage(recipeId);
                        
                        // Update preview to placeholder
                        const preview = document.getElementById('recipe-image-preview');
                        preview.outerHTML = `
                            <div class="no-image-placeholder" id="recipe-image-preview">
                                <span>🍹</span>
                                <p>Nincs kép feltöltve</p>
                            </div>
                        `;
                        
                        // Remove delete button
                        deleteBtn.remove();
                        
                        this.showAlert('Kép törölve!', 'success');
                    } catch (error) {
                        this.showAlert('Hiba a kép törlésekor: ' + error.message, 'error');
                        deleteBtn.disabled = false;
                        deleteBtn.innerHTML = '🗑️ Kép törlése';
                    }
                });
            }
        }

        // Add ingredient button
        document.getElementById('add-ingredient-btn').addEventListener('click', () => {
            const list = document.getElementById('ingredients-list');
            const index = list.children.length;
            const newRow = document.createElement('div');
            newRow.innerHTML = this.renderIngredientRow(ingredients, null, index);
            list.appendChild(newRow.firstElementChild);
            this.attachIngredientRowEvents();
        });

        this.attachIngredientRowEvents();

        // Form submit
        document.getElementById('recipe-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            
            // Collect ingredients
            const ingredientRows = document.querySelectorAll('.ingredient-row');
            const recipeIngredients = [];
            
            ingredientRows.forEach((row, idx) => {
                const ingredientId = row.querySelector('[name="ingredient_id[]"]').value;
                const quantity = row.querySelector('[name="quantity[]"]').value;
                const unit = row.querySelector('[name="unit[]"]').value;
                
                if (ingredientId && quantity) {
                    recipeIngredients.push({
                        ingredient_id: parseInt(ingredientId),
                        quantity: parseFloat(quantity),
                        unit: unit,
                        order_number: idx + 1
                    });
                }
            });

            if (recipeIngredients.length === 0) {
                this.showAlert('Add hozzá legalább egy alapanyagot!', 'error');
                return;
            }

            const data = {
                name: formData.get('name'),
                description: formData.get('description'),
                category: formData.get('category'),
                difficulty: formData.get('difficulty'),
                glass_type: formData.get('glass_type'),
                garnish: formData.get('garnish'),
                instructions: formData.get('instructions'),
                is_alcoholic: formData.get('is_alcoholic') === 'on',
                ingredients: recipeIngredients
            };

            try {
                if (isEdit) {
                    await API.updateRecipe(recipeId, data);
                    this.showAlert('Recept frissítve!', 'success');
                } else {
                    await API.createRecipe(data);
                    this.showAlert('Recept létrehozva!', 'success');
                }
                
                modalContainer.remove();
                this.showAdminTab('recipes');
            } catch (error) {
                this.showAlert('Hiba: ' + error.message, 'error');
            }
        });
    },

    renderIngredientRow(ingredients, ingredient = null, index = 0) {
        return `
            <div class="ingredient-row">
                <div class="ingredient-select">
                    <select name="ingredient_id[]" required>
                        <option value="">Válassz alapanyagot...</option>
                        ${ingredients.map(ing => `
                            <option value="${ing.id}" ${ingredient?.ingredient_id == ing.id ? 'selected' : ''}>
                                ${ing.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="ingredient-quantity">
                    <input type="number" name="quantity[]" placeholder="Mennyiség" 
                        value="${ingredient?.quantity || ''}" min="0" step="0.1" required>
                </div>
                <div class="ingredient-unit">
                    <select name="unit[]">
                        <option value="ml" ${ingredient?.unit === 'ml' ? 'selected' : ''}>ml</option>
                        <option value="cl" ${ingredient?.unit === 'cl' ? 'selected' : ''}>cl</option>
                        <option value="l" ${ingredient?.unit === 'l' ? 'selected' : ''}>l</option>
                        <option value="dash" ${ingredient?.unit === 'dash' ? 'selected' : ''}>dash</option>
                        <option value="splash" ${ingredient?.unit === 'splash' ? 'selected' : ''}>splash</option>
                    </select>
                </div>
                <button type="button" class="btn-remove-ingredient">✕</button>
            </div>
        `;
    },

    attachIngredientRowEvents() {
        document.querySelectorAll('.btn-remove-ingredient').forEach(btn => {
            btn.onclick = (e) => {
                const row = e.target.closest('.ingredient-row');
                if (document.querySelectorAll('.ingredient-row').length > 1) {
                    row.remove();
                } else {
                    this.showAlert('Legalább egy hozzávaló kell!', 'error');
                }
            };
        });
    },

    // Statistics
    async renderStats(days = 30) {
        try {
            // Get stats cards container
            const statsCards = document.getElementById('stats-cards');
            if (!statsCards) {
                console.error('stats-cards element not found');
                return;
            }
            
            // Show loading
            this.showLoading('stats-cards', 'Statisztikák betöltése...');
            
            // Fetch stats data
            const stats = await API.fetch('/stats');
            const dailyStats = await API.fetch(`/stats/daily?days=${days}`);
            const costStats = await API.fetch(`/stats/costs?days=${days}`);

            // Clear loading and render cards with icons
            statsCards.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon">🍹</div>
                    <div class="stat-value" id="stat-total-drinks">${stats.total_drinks || 0}</div>
                    <div class="stat-label">Összes ital</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💧</div>
                    <div class="stat-value" id="stat-total-volume">${((stats.total_volume_ml || 0) / 1000).toFixed(1)}</div>
                    <div class="stat-label">Összes mennyiség (L)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-value" id="stat-active-alerts">${stats.active_alerts || 0}</div>
                    <div class="stat-label">Aktív riasztások</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📦</div>
                    <div class="stat-value" id="stat-low-stock">${stats.inventory?.low_stock_items || 0}</div>
                    <div class="stat-label">Alacsony készlet</div>
                </div>
            `;

            // Render cost analytics section
            this.renderCostAnalytics(costStats, days);

            // Update chart title
            const chartTitle = document.getElementById('daily-chart-title');
            if (chartTitle) {
                const titleText = days === 1 
                    ? 'Napi fogyasztás (ma)' 
                    : `Napi fogyasztás (utolsó ${days} nap)`;
                chartTitle.textContent = titleText;
            }

            // Render charts
            this.renderDailyConsumptionChart(dailyStats);
            this.renderPopularDrinksChart(stats.popular_recipes || []);

        } catch (error) {
            console.error('Error loading stats:', error);
            this.showAlert('Hiba a statisztikák betöltésekor: ' + error.message, 'error');
            const statsCards = document.getElementById('stats-cards');
            if (statsCards) {
                this.showEmptyState('stats-cards', {
                    icon: '📊',
                    title: 'Hiba történt',
                    message: 'Nem sikerült betölteni a statisztikákat. ' + error.message
                });
            }
        }
    },

    renderDailyConsumptionChart(dailyData) {
        const ctx = document.getElementById('dailyConsumptionChart');
        if (!ctx) return;

        console.log('Daily stats data:', dailyData); // Debug log

        // Destroy previous chart if exists
        if (this.dailyChart) {
            this.dailyChart.destroy();
        }

        // Check if we have data
        if (!dailyData || dailyData.length === 0) {
            console.warn('No daily consumption data available');
            // Show "No data" message
            ctx.parentElement.innerHTML = '<div class="no-data-message">Nincs elérhető adat ebben az időszakban</div><canvas id="dailyConsumptionChart"></canvas>';
            return;
        }

        // Reverse data to show oldest to newest (left to right)
        const reversedData = [...dailyData].reverse();

        // Prepare data
        const labels = reversedData.map(d => {
            // Format date properly - date comes as string 'YYYY-MM-DD' from backend
            // Handle both string format and potential datetime format
            let dateStr = d.date;
            if (typeof dateStr !== 'string') {
                dateStr = String(dateStr);
            }
            // Remove time part if exists (e.g., '2025-11-06T00:00:00.000Z' -> '2025-11-06')
            if (dateStr.includes('T')) {
                dateStr = dateStr.split('T')[0];
            }
            const [year, month, day] = dateStr.split('-');
            // Create short format: MM.DD.
            return `${month}.${day}.`;
        });
        const data = reversedData.map(d => d.drinks_count || 0);

        this.dailyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Elkészített italok',
                    data: data,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#2196F3',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                // Show full date in tooltip
                                const dataPoint = reversedData[context[0].dataIndex];
                                let dateStr = dataPoint.date;
                                if (typeof dateStr !== 'string') {
                                    dateStr = String(dateStr);
                                }
                                // Remove time part if exists
                                if (dateStr.includes('T')) {
                                    dateStr = dateStr.split('T')[0];
                                }
                                const [year, month, day] = dateStr.split('-');
                                return `${year}. ${month}. ${day}.`;
                            },
                            label: function(context) {
                                return context.parsed.y + ' ital';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            precision: 0
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 15
                        }
                    }
                }
            }
        });
    },

    renderPopularDrinksChart(popularRecipes) {
        const ctx = document.getElementById('popularDrinksChart');
        if (!ctx) return;

        // Destroy previous chart if exists
        if (this.popularChart) {
            this.popularChart.destroy();
        }

        // Prepare data
        const labels = popularRecipes.map(r => r.name);
        const data = popularRecipes.map(r => r.count);

        // Generate colors
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ];

        this.popularChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Készítések száma',
                    data: data,
                    backgroundColor: colors.slice(0, data.length),
                    borderColor: colors.slice(0, data.length).map(c => c.replace('0.6', '1')),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' alkalommal';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    },

    renderCostAnalytics(costStats, days) {
        const section = document.getElementById('cost-analytics-section');
        if (!section) return;

        // Show section
        section.style.display = 'block';

        // Render cost summary cards
        const costCards = document.getElementById('cost-cards');
        if (costCards) {
            const mostExpensive = costStats.expensive_recipes && costStats.expensive_recipes.length > 0
                ? costStats.expensive_recipes[0]
                : null;

            costCards.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-value">${costStats.today_cost.toFixed(2)} Ft</div>
                    <div class="stat-label">Mai költség</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${costStats.total_cost.toFixed(2)} Ft</div>
                    <div class="stat-label">Összes költség (${days} nap)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📈</div>
                    <div class="stat-value">${costStats.average_cost.toFixed(2)} Ft</div>
                    <div class="stat-label">Átlagos ital ár</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-value">${mostExpensive ? mostExpensive.cost.toFixed(2) + ' Ft' : '-'}</div>
                    <div class="stat-label">${mostExpensive ? mostExpensive.name : 'Nincs adat'}</div>
                </div>
            `;
        }

        // Update chart title
        const breakdownTitle = document.getElementById('cost-breakdown-title');
        if (breakdownTitle) {
            const titleText = days === 1 
                ? 'Költség megoszlás alapanyagonként (ma)' 
                : `Költség megoszlás alapanyagonként (${days} nap)`;
            breakdownTitle.textContent = titleText;
        }

        // Render charts
        this.renderCostBreakdownChart(costStats.ingredient_breakdown || []);
        this.renderExpensiveRecipesChart(costStats.expensive_recipes || []);
    },

    renderCostBreakdownChart(ingredientBreakdown) {
        const ctx = document.getElementById('costBreakdownChart');
        if (!ctx) return;

        // Destroy previous chart if exists
        if (this.costBreakdownChart) {
            this.costBreakdownChart.destroy();
        }

        // Prepare data
        const labels = ingredientBreakdown.map(i => i.name);
        const data = ingredientBreakdown.map(i => i.cost);

        // Generate colors
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ];

        this.costBreakdownChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Költség (Ft)',
                    data: data,
                    backgroundColor: colors.slice(0, data.length),
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toFixed(2)} Ft (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    renderExpensiveRecipesChart(expensiveRecipes) {
        const ctx = document.getElementById('expensiveRecipesChart');
        if (!ctx) return;

        // Destroy previous chart if exists
        if (this.expensiveChart) {
            this.expensiveChart.destroy();
        }

        // Prepare data
        const labels = expensiveRecipes.map(r => r.name);
        const data = expensiveRecipes.map(r => r.cost);

        // Generate colors
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'];

        this.expensiveChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Költség (Ft)',
                    data: data,
                    backgroundColor: colors.slice(0, data.length),
                    borderColor: colors.slice(0, data.length),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y', // Horizontal bar chart
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.x.toFixed(2) + ' Ft';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2) + ' Ft';
                            }
                        }
                    }
                }
            }
        });
    },

    // Maintenance Admin
    async renderMaintenanceAdmin(container) {
        this.showLoading(container, 'Karbantartási adatok betöltése...');
        
        try {
            // Fetch pumps and maintenance history
            const pumps = await API.getPumps();
            const stats = await API.fetch('/maintenance/stats');
            const history = await API.fetch('/maintenance/history?limit=20');

            container.innerHTML = `
                <div class="admin-header">
                    <h3>Pumpa karbantartás</h3>
                    <button class="btn-primary" id="btn-flush-all">🌊 Összes pumpa öblítése</button>
                </div>

                <!-- Statistics Cards -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">🚿</div>
                        <div class="stat-value">${stats.overall.total_flushes || 0}</div>
                        <div class="stat-label">Összes öblítés</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">⚙️</div>
                        <div class="stat-value">${stats.overall.total_calibrations || 0}</div>
                        <div class="stat-label">Kalibrációk</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">⏱️</div>
                        <div class="stat-value">${((stats.overall.avg_flush_duration_ms || 0) / 1000).toFixed(1)}s</div>
                        <div class="stat-label">Átlag öblítési idő</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📅</div>
                        <div class="stat-value">${stats.overall.last_maintenance ? new Date(stats.overall.last_maintenance).toLocaleDateString('hu-HU') : 'Nincs'}</div>
                        <div class="stat-label">Utolsó karbantartás</div>
                    </div>
                </div>

                <!-- Pumps List with Flush Buttons -->
                <div class="maintenance-section">
                    <h4>Pumpák öblítése</h4>
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Alapanyag</th>
                                <th>Utolsó karbantartás</th>
                                <th>Műveletek</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pumps.map(pump => {
                                const pumpStat = stats.by_pump.find(s => s.id === pump.id);
                                const lastMaintenance = pumpStat?.last_maintenance 
                                    ? new Date(pumpStat.last_maintenance).toLocaleString('hu-HU')
                                    : 'Soha';
                                
                                return `
                                    <tr>
                                        <td>#${pump.pump_number}</td>
                                        <td>${pump.ingredient_name || '-'}</td>
                                        <td><small>${lastMaintenance}</small></td>
                                        <td class="action-buttons">
                                            <button class="btn-flush" data-pump-id="${pump.id}" data-pump-number="${pump.pump_number}" data-ingredient="${pump.ingredient_name}">
                                                🚿 Öblítés
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Maintenance History -->
                <div class="maintenance-section">
                    <h4>Karbantartási előzmények</h4>
                    ${history.logs.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state-icon">📋</div>
                            <div class="empty-state-message">Még nincs karbantartási előzmény</div>
                        </div>
                    ` : `
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Dátum</th>
                                    <th>Pumpa</th>
                                    <th>Művelet</th>
                                    <th>Időtartam</th>
                                    <th>Megjegyzés</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.logs.map(log => `
                                    <tr>
                                        <td><small>${new Date(log.performed_at).toLocaleString('hu-HU')}</small></td>
                                        <td>#${log.pump_number} ${log.ingredient_name || '-'}</td>
                                        <td>
                                            <span class="badge badge-${log.action_type}">
                                                ${log.action_type === 'flush' ? '🚿 Öblítés' : 
                                                  log.action_type === 'calibration' ? '⚙️ Kalibráció' : 
                                                  log.action_type === 'repair' ? '🔧 Javítás' : '📝 Egyéb'}
                                            </span>
                                        </td>
                                        <td>${log.duration_ms ? (log.duration_ms / 1000).toFixed(1) + 's' : '-'}</td>
                                        <td><small>${log.notes || '-'}</small></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            `;

            // Event listeners
            document.getElementById('btn-flush-all').addEventListener('click', () => {
                this.showFlushModal('all');
            });

            document.querySelectorAll('.btn-flush').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const pumpId = e.target.dataset.pumpId;
                    const pumpNumber = e.target.dataset.pumpNumber;
                    const ingredientName = e.target.dataset.ingredient;
                    this.showFlushModal(pumpId, pumpNumber, ingredientName);
                });
            });

        } catch (error) {
            this.showEmptyState(container, {
                icon: '❌',
                title: 'Hiba történt',
                message: error.message,
                action: {
                    text: '🔄 Újrapróbálás',
                    callback: () => this.showAdminTab('maintenance')
                }
            });
        }
    },

    showFlushModal(pumpId, pumpNumber, ingredientName) {
        const isBulk = pumpId === 'all';
        const title = isBulk ? 'Összes pumpa öblítése' : `Pumpa #${pumpNumber}`;
        const subtitle = isBulk ? 'Minden aktív pumpa' : ingredientName || 'Nincs hozzárendelve';

        const modalHtml = `
            <div class="modal-overlay" id="flush-modal">
                <div class="modal-dialog flush-modal-dialog">
                    <div class="modal-header flush-modal-header">
                        <div class="flush-title-wrapper">
                            <div class="flush-icon">🚿</div>
                            <div class="flush-title-text">
                                <h3>${title}</h3>
                                <p class="flush-subtitle">${subtitle}</p>
                            </div>
                        </div>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="flush-steps">
                            <div class="flush-step">
                                <div class="step-number">1</div>
                                <div class="step-content">
                                    <h5>Cső átrakása</h5>
                                    <p>Rakd át a ${isBulk ? 'csöveket' : 'csövet'} egy tiszta vizes tartályba!</p>
                                </div>
                            </div>
                            <div class="flush-step">
                                <div class="step-number">2</div>
                                <div class="step-content">
                                    <h5>Edény elhelyezése</h5>
                                    <p>Helyezz ${isBulk ? 'edényeket' : 'poharat'} a kifolyó alá!</p>
                                </div>
                            </div>
                            <div class="flush-step">
                                <div class="step-number">3</div>
                                <div class="step-content">
                                    <h5>Indítás</h5>
                                    <p>Állítsd be az időtartamot és indítsd el az öblítést!</p>
                                </div>
                            </div>
                        </div>

                        <div class="flush-duration-control">
                            <label for="flush-duration">
                                <span class="duration-icon">⏱️</span>
                                Öblítési időtartam
                            </label>
                            <div class="duration-display">
                                <span id="duration-value" class="duration-number">5</span>
                                <span class="duration-unit">másodperc</span>
                            </div>
                            <input type="range" id="flush-duration" min="3" max="30" value="5" step="1" class="flush-slider">
                            <div class="slider-labels">
                                <span>3s</span>
                                <span>15s</span>
                                <span>30s</span>
                            </div>
                        </div>

                        <div id="flush-progress" class="flush-progress" style="display: none;">
                            <div class="progress-bar">
                                <div class="progress-fill" id="flush-progress-bar"></div>
                            </div>
                            <div class="progress-text">
                                <span id="flush-status">💧 Öblítés folyamatban...</span>
                                <span id="flush-time-remaining">5s</span>
                            </div>
                        </div>

                        <div id="flush-complete" class="flush-complete" style="display: none;">
                            <div class="success-icon">✅</div>
                            <h4>Öblítés sikeresen befejezve!</h4>
                            <div class="flush-reminder">
                                <div class="reminder-icon">⚠️</div>
                                <p>Ne felejtsd el visszarakni a ${isBulk ? 'csöveket az eredeti üvegekbe' : 'csövet a ' + (ingredientName || 'pumpa') + ' üvegébe'}!</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" id="btn-cancel-flush">Mégse</button>
                        <button class="btn-primary" id="btn-start-flush">
                            <span class="btn-icon">▶️</span>
                            Öblítés indítása
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('flush-modal');
        const durationSlider = document.getElementById('flush-duration');
        const durationValue = document.getElementById('duration-value');
        const startButton = document.getElementById('btn-start-flush');
        const cancelButton = document.getElementById('btn-cancel-flush');
        const progressDiv = document.getElementById('flush-progress');
        const completeDiv = document.getElementById('flush-complete');

        // Slider update
        durationSlider.addEventListener('input', (e) => {
            durationValue.textContent = e.target.value;
        });

        // Cancel button
        const closeModal = () => {
            modal.remove();
        };
        
        cancelButton.addEventListener('click', closeModal);
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Start flush button
        startButton.addEventListener('click', async () => {
            const durationSeconds = parseInt(durationSlider.value);
            const durationMs = durationSeconds * 1000;

            // Hide button, show progress
            startButton.style.display = 'none';
            cancelButton.disabled = true;
            durationSlider.disabled = true;
            progressDiv.style.display = 'block';

            const progressBar = document.getElementById('flush-progress-bar');
            const statusText = document.getElementById('flush-status');
            const timeRemaining = document.getElementById('flush-time-remaining');

            // Start flush via API
            try {
                const endpoint = isBulk 
                    ? '/maintenance/flush-all'
                    : `/maintenance/flush/${pumpId}`;
                
                const response = await API.fetch(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({ duration_ms: durationMs, notes: 'Kézzel indított öblítés az admin panelről' })
                });

                if (!response.success) {
                    throw new Error('Flush failed');
                }

                // Animate progress bar
                const startTime = Date.now();
                const updateProgress = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min((elapsed / durationMs) * 100, 100);
                    const remaining = Math.max(durationSeconds - Math.floor(elapsed / 1000), 0);

                    progressBar.style.width = progress + '%';
                    timeRemaining.textContent = remaining + 's';

                    if (progress < 100) {
                        requestAnimationFrame(updateProgress);
                    } else {
                        // Flush complete
                        progressDiv.style.display = 'none';
                        completeDiv.style.display = 'block';
                        cancelButton.textContent = 'Bezár';
                        cancelButton.disabled = false;
                        
                        this.showAlert(isBulk ? 'Összes pumpa öblítve!' : `Pumpa #${pumpNumber} öblítve!`, 'success');
                    }
                };

                updateProgress();

            } catch (error) {
                statusText.textContent = '❌ Hiba történt!';
                this.showAlert('Öblítési hiba: ' + error.message, 'error');
                cancelButton.disabled = false;
                cancelButton.textContent = 'Bezár';
            }
        });
    },

    async renderBackupAdmin(container) {
        container.innerHTML = `
            <div class="backup-section">
                <div class="section-header">
                    <h2>Adatbázis mentés és visszaállítás</h2>
                </div>

                <div class="backup-actions">
                    <div class="backup-card export-card">
                        <div class="card-icon">📤</div>
                        <h3>Adatbázis exportálása</h3>
                        <p>Töltsd le az adatbázis teljes tartalmát SQL fájlként. A fájl tartalmazza az összes táblát, adatot és struktúrát.</p>
                        <button class="btn-primary" id="btn-export-db">
                            <span class="btn-icon">⬇️</span>
                            Adatbázis letöltése
                        </button>
                    </div>

                    <div class="backup-card import-card">
                        <div class="card-icon">📥</div>
                        <h3>Adatbázis visszaállítása</h3>
                        <p>Importálj egy korábban mentett SQL fájlt. <strong>FIGYELEM:</strong> Ez felülírja a jelenlegi adatokat!</p>
                        <div class="file-upload-area" id="upload-area">
                            <input type="file" id="sql-file-input" accept=".sql" style="display: none;">
                            <div class="upload-placeholder" id="upload-placeholder">
                                <span class="upload-icon">📁</span>
                                <p>Kattints vagy húzd ide az SQL fájlt</p>
                                <small>.sql fájlok, max 100MB</small>
                            </div>
                            <div class="file-selected" id="file-selected" style="display: none;">
                                <span class="file-icon">📄</span>
                                <span class="file-name" id="selected-file-name"></span>
                                <button class="btn-remove" id="btn-remove-file">✕</button>
                            </div>
                        </div>
                        <button class="btn-danger" id="btn-import-db" disabled>
                            <span class="btn-icon">⚠️</span>
                            Visszaállítás indítása
                        </button>
                        <div class="backup-warning">
                            <small>⚠️ A visszaállítás FELÜLÍRJA az összes adatot!</small>
                        </div>
                    </div>
                </div>

                <div class="backup-help">
                    <h4>Útmutató</h4>
                    <ul>
                        <li><strong>Rendszeres mentés:</strong> Javasolt hetente/havonta mentést készíteni</li>
                        <li><strong>Biztonságos tárolás:</strong> Tárold a backup fájlokat biztonságos helyen (cloud, külső merevlemez)</li>
                        <li><strong>Visszaállítás előtt:</strong> Mindig készíts friss mentést mielőtt visszaállítasz!</li>
                    </ul>
                </div>
            </div>
        `;

        // Export button
        const exportBtn = document.getElementById('btn-export-db');
        exportBtn.addEventListener('click', () => {
            this.showAlert('📥 Adatbázis letöltése...', 'info');
            API.exportDatabase();
            setTimeout(() => {
                this.showAlert('✅ Adatbázis sikeresen letöltve!', 'success');
            }, 1000);
        });

        // File upload handling
        const fileInput = document.getElementById('sql-file-input');
        const uploadArea = document.getElementById('upload-area');
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        const fileSelected = document.getElementById('file-selected');
        const selectedFileName = document.getElementById('selected-file-name');
        const importBtn = document.getElementById('btn-import-db');
        const removeFileBtn = document.getElementById('btn-remove-file');

        let selectedFile = null;

        // Click to upload
        uploadArea.addEventListener('click', () => {
            if (!selectedFile) {
                fileInput.click();
            }
        });

        // File selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!file.name.endsWith('.sql')) {
                    this.showAlert('❌ Csak .sql fájlokat lehet feltölteni!', 'error');
                    return;
                }
                if (file.size > 100 * 1024 * 1024) {
                    this.showAlert('❌ A fájl túl nagy! Maximum 100MB megengedett.', 'error');
                    return;
                }
                selectedFile = file;
                selectedFileName.textContent = file.name;
                uploadPlaceholder.style.display = 'none';
                fileSelected.style.display = 'flex';
                importBtn.disabled = false;
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.sql')) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event('change'));
            } else {
                this.showAlert('❌ Csak .sql fájlokat lehet feltölteni!', 'error');
            }
        });

        // Remove file
        removeFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedFile = null;
            fileInput.value = '';
            uploadPlaceholder.style.display = 'block';
            fileSelected.style.display = 'none';
            importBtn.disabled = true;
        });

        // Import button
        importBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            const confirmed = confirm(
                '⚠️ FIGYELEM!\n\n' +
                'Ez a művelet FELÜLÍRJA az ÖSSZES adatot az adatbázisban!\n\n' +
                'Biztosan folytatod a visszaállítást?'
            );

            if (!confirmed) return;

            try {
                importBtn.disabled = true;
                importBtn.innerHTML = '<span class="spinner"></span> Visszaállítás...';
                
                this.showAlert('⏳ Adatbázis visszaállítása folyamatban...', 'info');
                
                const result = await API.importDatabase(selectedFile);
                
                this.showAlert('✅ ' + result.message, 'success');
                
                // Reset file selection
                selectedFile = null;
                fileInput.value = '';
                uploadPlaceholder.style.display = 'block';
                fileSelected.style.display = 'none';
                importBtn.disabled = true;
                importBtn.innerHTML = '<span class="btn-icon">⚠️</span> Visszaállítás indítása';
                
                // Reload page after 2 seconds
                setTimeout(() => {
                    this.showAlert('🔄 Oldal újratöltése...', 'info');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }, 2000);

            } catch (error) {
                this.showAlert('❌ Visszaállítási hiba: ' + error.message, 'error');
                importBtn.disabled = false;
                importBtn.innerHTML = '<span class="btn-icon">⚠️</span> Visszaállítás indítása';
            }
        });
    }
};

