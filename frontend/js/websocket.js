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

// WebSocket event handlers are registered in main.js
// This keeps websocket.js focused only on connection management
