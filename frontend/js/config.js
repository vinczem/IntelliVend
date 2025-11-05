// API configuration
const API_CONFIG = {
    baseURL: (() => {
        // Check if we're running through Home Assistant Ingress
        const path = window.location.pathname;
        if (path.includes('/api/hassio_ingress/')) {
            // Extract ingress base path and append /api
            const ingressMatch = path.match(/^(\/api\/hassio_ingress\/[^\/]+)/);
            return ingressMatch ? ingressMatch[1] + '/api' : '/api';
        }
        return '/api';
    })(),
    timeout: 10000
};
