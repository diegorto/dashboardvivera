const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  const env = {};
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  } catch (error) {
    console.warn(`Warning: Could not load ${filePath}`);
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: 'meta',
      script: './meta-server/server.js',
      cwd: __dirname,
      env: loadEnvFile(path.join(__dirname, 'meta-server/.env')),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      error_file: './logs/meta-error.log',
      out_file: './logs/meta-out.log'
    },
    {
      name: 'google',
      script: './google-server/server.js',
      cwd: __dirname,
      env: loadEnvFile(path.join(__dirname, 'google-server/.env')),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      error_file: './logs/google-error.log',
      out_file: './logs/google-out.log'
    },
    {
      name: 'tintim',
      script: './tintim-server/server.js',
      cwd: __dirname,
      env: loadEnvFile(path.join(__dirname, 'tintim-server/.env')),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      error_file: './logs/tintim-error.log',
      out_file: './logs/tintim-out.log'
    },
    {
      name: 'pipedrive',
      script: './pipedrive-server/server.js',
      cwd: __dirname,
      env: loadEnvFile(path.join(__dirname, 'pipedrive-server/.env')),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      error_file: './logs/pipedrive-error.log',
      out_file: './logs/pipedrive-out.log'
    },
    {
      name: 'dashboard',
      script: './dashboard-frontend/server.js',
      cwd: __dirname,
      env: loadEnvFile(path.join(__dirname, 'dashboard-frontend/.env')),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      error_file: './logs/dashboard-error.log',
      out_file: './logs/dashboard-out.log'
    }
  ]
};
