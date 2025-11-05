/**
 * WebSocket Client - Real-time MQTT Updates
 * 
 * Handles Socket.IO connection to backend for real-time ESP32 updates
 */

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.callbacks = {
      'dispense:status': [],
      'dispense:complete': [],
      'maintenance:complete': [],
      'esp32:error': [],
      'esp32:heartbeat': []
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    // Detect WebSocket URL based on current location
    let serverUrl;
    let socketPath;
    const pathname = window.location.pathname;
    
    if (pathname.includes('/api/hassio_ingress/')) {
      // Running through Home Assistant Ingress
      const ingressMatch = pathname.match(/^(\/api\/hassio_ingress\/[^\/]+)/);
      const ingressBase = ingressMatch ? ingressMatch[1] : '';
      
      // For Ingress, we need to use the origin WITHOUT the ingress path in URL
      // but the path MUST include the ingress base + /socket.io
      serverUrl = window.location.origin;
      socketPath = ingressBase + '/socket.io';
    } else {
      // Direct access or development mode
      serverUrl = window.location.origin;
      socketPath = '/socket.io';
    }
    
    // Load Socket.IO library dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
    script.onload = () => {
      this.socket = io(serverUrl, {
        path: socketPath,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity
      });

      this.setupEventHandlers();
    };
    script.onerror = () => {
      console.error('Failed to load Socket.IO library');
    };
    document.head.appendChild(script);
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.socket.on('connect', () => {
      this.connected = true;
      this.updateConnectionStatus(true);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.updateConnectionStatus(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.updateConnectionStatus(false);
    });

    // MQTT event handlers
    this.socket.on('dispense:status', (data) => {
      this.trigger('dispense:status', data);
    });

    this.socket.on('dispense:complete', (data) => {
      this.trigger('dispense:complete', data);
    });

    this.socket.on('maintenance:complete', (data) => {
      this.trigger('maintenance:complete', data);
    });

    this.socket.on('esp32:error', (data) => {
      console.error('ESP32 error:', data);
      this.trigger('esp32:error', data);
    });

    this.socket.on('esp32:heartbeat', (data) => {
      this.trigger('esp32:heartbeat', data);
    });
  }

  /**
   * Update connection status indicator in UI
   */
  updateConnectionStatus(connected) {
    const indicator = document.getElementById('ws-status');
    if (indicator) {
      if (connected) {
        indicator.innerHTML = '<span class="status-dot status-online"></span> Real-time: Connected';
        indicator.classList.remove('offline');
        indicator.classList.add('online');
      } else {
        indicator.innerHTML = '<span class="status-dot status-offline"></span> Real-time: Disconnected';
        indicator.classList.remove('online');
        indicator.classList.add('offline');
      }
    }
  }

  /**
   * Subscribe to an event
   */
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  /**
   * Trigger all callbacks for an event
   */
  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
}

// Global WebSocket instance
const wsClient = new WebSocketClient();

// Auto-connect when page loads OR immediately if DOM already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    wsClient.connect();
  });
} else {
  wsClient.connect();
}

// Keep the old event listener for compatibility
document.addEventListener('DOMContentLoaded', () => {
  wsClient.connect();
  
  // Example: Listen for dispense status updates
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
  
  // Example: Show alert on completion
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
  
  // Example: Show alert on maintenance complete
  wsClient.on('maintenance:complete', (data) => {
    if (typeof UI !== 'undefined' && UI.showAlert) {
      UI.showAlert(`Karbantartás befejezve: ${data.pump_id}. pumpa`, 'success');
    }
    
    // Refresh maintenance history if on maintenance page
    if (typeof loadMaintenanceHistory === 'function') {
      loadMaintenanceHistory();
    }
  });
  
  // Example: Show error notifications
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
  
  // Example: Update ESP32 status indicator
  let lastHeartbeat = Date.now();
  wsClient.on('esp32:heartbeat', (data) => {
    lastHeartbeat = Date.now();
    
    const esp32Status = document.getElementById('esp32-status');
    if (esp32Status) {
      // WiFi signal strength icons
      let wifiIcon = '📶';
      if (data.wifi_rssi < -80) wifiIcon = '�'; // Weak signal
      else if (data.wifi_rssi < -70) wifiIcon = '📶'; // Medium signal
      else wifiIcon = '�'; // Strong signal
      
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
});
