module.exports = {
  apps: [{ 
    name: 'dashboard', 
    script: 'server.js', 
    env: { PORT: 3000, NODE_ENV: 'production' }
  }]
};
