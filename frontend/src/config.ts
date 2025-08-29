// Configuration for different environments
const config = {
  // For local development
  development: {
    serverUrl: 'http://localhost:3001'
  },
  // For local network access
  localNetwork: {
    serverUrl: 'http://192.168.4.42:3001'
  },
  // For production (when you deploy)
  production: {
    serverUrl: process.env.REACT_APP_SERVER_URL || 'http://ludo-env-1.eba-mbadkmyd.eu-north-1.elasticbeanstalk.com'
  }
};

// Determine which environment to use
const isLocalNetwork = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const isProduction = process.env.NODE_ENV === 'production';

let currentConfig;
if (isProduction) {
  currentConfig = config.production;
} else if (isLocalNetwork) {
  currentConfig = config.localNetwork;
} else {
  currentConfig = config.development;
}

export const SERVER_URL = currentConfig.serverUrl;
