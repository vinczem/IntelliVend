// API functions
const API = {
    baseURL: API_CONFIG.baseURL,
    staticURL: `http://${window.location.hostname}:3000`,
    
    async fetch(endpoint, options = {}) {
        const url = `${API_CONFIG.baseURL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'API request failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Recipes
    getRecipes(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.fetch(`/recipes?${params}`);
    },

    getRecipe(id) {
        return this.fetch(`/recipes/${id}`);
    },

    createRecipe(data) {
        return this.fetch('/recipes', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    updateRecipe(id, data) {
        return this.fetch(`/recipes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    deleteRecipe(id) {
        return this.fetch(`/recipes/${id}`, {
            method: 'DELETE'
        });
    },

    async uploadRecipeImage(id, file) {
        const formData = new FormData();
        formData.append('image', file);
        
        const url = `${API_CONFIG.baseURL}/recipes/${id}/image`;
        const response = await fetch(url, {
            method: 'POST',
            body: formData
            // Note: Don't set Content-Type header, let browser set it with boundary
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Image upload failed');
        }
        
        const data = await response.json();
        return data.image_url;
    },

    deleteRecipeImage(id) {
        return this.fetch(`/recipes/${id}/image`, {
            method: 'DELETE'
        });
    },

    // Ingredients
    getIngredients() {
        return this.fetch('/ingredients');
    },

    getIngredient(id) {
        return this.fetch(`/ingredients/${id}`);
    },

    createIngredient(data) {
        return this.fetch('/ingredients', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    updateIngredient(id, data) {
        return this.fetch(`/ingredients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    deleteIngredient(id) {
        return this.fetch(`/ingredients/${id}`, {
            method: 'DELETE'
        });
    },

    // Pumps
    getPumps() {
        return this.fetch('/pumps');
    },

    getPump(id) {
        return this.fetch(`/pumps/${id}`);
    },

    assignPump(pumpId, data) {
        return this.fetch(`/pumps/${pumpId}/assign`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    calibratePump(pumpId, calibrationFactor) {
        return this.fetch(`/pumps/${pumpId}/calibrate`, {
            method: 'PUT',
            body: JSON.stringify({ calibration_factor: calibrationFactor })
        });
    },

    // Inventory
    getInventory() {
        return this.fetch('/inventory');
    },

    refillBottle(pumpId, data) {
        return this.fetch(`/inventory/refill/${pumpId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    refillAllBottles() {
        return this.fetch('/inventory/refill-all', {
            method: 'PUT'
        });
    },

    updateInventorySettings(pumpId, data) {
        return this.fetch(`/inventory/settings/${pumpId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    // Dispense
    dispenseDrink(recipeId, strength = 'normal') {
        return this.fetch('/dispense', {
            method: 'POST',
            body: JSON.stringify({ 
                recipe_id: recipeId,
                strength: strength 
            })
        });
    },

    updateDispenseStatus(logId, status, errorMessage = null) {
        return this.fetch(`/dispense/status/${logId}`, {
            method: 'PUT',
            body: JSON.stringify({ status, error_message: errorMessage })
        });
    },

    reportDispenseTimeout(logId) {
        return this.fetch(`/dispense/timeout/${logId}`, {
            method: 'POST'
        });
    },

    getDispenseHistory(limit = 50) {
        return this.fetch(`/dispense/history?limit=${limit}`);
    },

    // Alerts
    getAlerts(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.fetch(`/alerts?${params}`);
    },

    resolveAlert(id) {
        return this.fetch(`/alerts/${id}/resolve`, {
            method: 'PUT'
        });
    },

    deleteAlert(id) {
        return this.fetch(`/alerts/${id}`, {
            method: 'DELETE'
        });
    },

    // Stats
    getStats() {
        return this.fetch('/stats');
    },

    getDailyStats(days = 7) {
        return this.fetch(`/stats/daily?days=${days}`);
    }
};
