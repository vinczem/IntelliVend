// API configuration
const API_CONFIG = {
    baseURL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : '/api',
    timeout: 10000
};
