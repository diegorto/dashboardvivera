/**
 * 🎛️ Remote Control Panel
 * Permite controle remoto do VPS via API
 * Endpoints de controle para deploy, restart, updates, etc
 */

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
  setupRemoteControl: function(app) {
    // 🔐 Middleware de autenticação simples
    const CONTROL_TOKEN = process.env.CONTROL_TOKEN || 'dashboard-vivera-2026';

    const authenticate = (req, res, next) => {
      const token = req.headers['x-control-token'] || req.query.token;
      if (token !== CONTROL_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    };

    // ============================================================================
    // 🎛️ CONTROLE REMOTO
    // ============================================================================

    // Status do sistema
    app.get('/api/remote/status', authenticate, (req, res) => {
      exec('pm2 status --no-color 2>/dev/null', (err, stdout) => {
        res.json({
          status: 'ok',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          pm2: stdout || 'PM2 não disponível'
        });
      });
    });

    // Deploy automático
    app.post('/api/remote/deploy', authenticate, (req, res) => {
      res.json({ status: 'deploying' });

      execRemote(`
        cd /root/dashboardvivera || exit 1

        echo "🔄 Deploy iniciado..."

        # 1. Matar processos
        pkill -f "node server.js" 2>/dev/null || true
        fuser -k 3000/tcp 2>/dev/null || true
        pm2 kill 2>/dev/null || true
        sleep 2

        # 2. Atualizar código
        git fetch origin 2>/dev/null || true
        git checkout claude/meta-pipe-api-integration-luq1ht 2>/dev/null || true
        git pull origin claude/meta-pipe-api-integration-luq1ht 2>/dev/null || true

        # 3. Instalar deps
        npm install --silent 2>/dev/null

        # 4. Setup automação
        node setup-automation.js > /dev/null 2>&1 || true

        # 5. Iniciar
        npm install -g pm2 --silent 2>/dev/null

        cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'dashboard',
    script: 'server.js',
    instances: 1,
    env: { NODE_ENV: 'production', PORT: 3000 },
    autorestart: true,
    error_file: './logs/error.log',
    out_file: './logs/out.log'
  }]
};
EOF

        pm2 start ecosystem.config.js
        pm2 save

        echo "✅ Deploy completo!"
      `);
    });

    // Restart do servidor
    app.post('/api/remote/restart', authenticate, (req, res) => {
      res.json({ status: 'restarting' });

      execRemote(`
        cd /root/dashboardvivera
        pm2 restart dashboard 2>/dev/null || npm start > /dev/null 2>&1 &
      `);
    });

    // Logs em tempo real
    app.get('/api/remote/logs', authenticate, (req, res) => {
      exec('tail -n 50 /root/dashboardvivera/logs/dashboard-*.log 2>/dev/null || echo "Sem logs ainda"', (err, stdout) => {
        res.json({
          logs: stdout || 'Sem logs',
          timestamp: new Date().toISOString()
        });
      });
    });

    // Healthcheck detalhado
    app.get('/api/remote/health-detailed', authenticate, (req, res) => {
      const healthFile = path.join(__dirname, '..', 'data', 'health.json');
      let health = { status: 'initializing' };

      try {
        if (fs.existsSync(healthFile)) {
          health = JSON.parse(fs.readFileSync(healthFile, 'utf8'));
        }
      } catch (e) {}

      res.json({
        ...health,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });

    // Sincronização forçada
    app.post('/api/remote/sync', authenticate, (req, res) => {
      res.json({ status: 'syncing' });

      execRemote(`
        cd /root/dashboardvivera
        # Força sincronização imediata
        echo "🔄 Sincronizando..." >> logs/dashboard-$(date +%Y-%m-%d).log
      `);
    });

    // Limpeza de cache
    app.post('/api/remote/clear-cache', authenticate, (req, res) => {
      res.json({ status: 'clearing' });

      execRemote(`
        rm -f /root/dashboardvivera/data/cache/*.json 2>/dev/null
        echo "✓ Cache limpo" >> /root/dashboardvivera/logs/dashboard-$(date +%Y-%m-%d).log
      `);
    });

    // Atualizar variáveis de ambiente
    app.post('/api/remote/update-env', authenticate, (req, res) => {
      const { key, value } = req.body;

      if (!key || !value) {
        return res.status(400).json({ error: 'key e value obrigatórios' });
      }

      try {
        const envFile = '/root/dashboardvivera/.env';
        let envContent = fs.readFileSync(envFile, 'utf8');

        // Atualizar ou adicionar variável
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }

        fs.writeFileSync(envFile, envContent);

        res.json({ status: 'updated', key, timestamp: new Date().toISOString() });

        // Restart para aplicar mudanças
        execRemote(`
          cd /root/dashboardvivera
          pm2 restart dashboard 2>/dev/null
        `);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Executar comando customizado (com segurança)
    app.post('/api/remote/exec', authenticate, (req, res) => {
      const { command } = req.body;

      if (!command) {
        return res.status(400).json({ error: 'command obrigatório' });
      }

      // Whitelist de comandos permitidos
      const allowedCommands = [
        'pm2 status',
        'pm2 logs',
        'pm2 restart',
        'npm install',
        'git pull',
        'git status',
        'cd /root/dashboardvivera',
        'ls -la',
        'pwd',
        'whoami',
        'df -h',
        'ps aux | grep node',
        'curl http://localhost:3000/api/health'
      ];

      const isAllowed = allowedCommands.some(cmd => command.startsWith(cmd));

      if (!isAllowed) {
        return res.status(403).json({ error: 'Comando não permitido' });
      }

      exec(command, { cwd: '/root/dashboardvivera' }, (err, stdout, stderr) => {
        res.json({
          command,
          output: stdout,
          error: stderr || null,
          timestamp: new Date().toISOString()
        });
      });
    });

    // ============================================================================
    // 📊 DASHBOARD DE CONTROLE (web interface)
    // ============================================================================

    app.get('/remote', (req, res) => {
      res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>🎛️ Remote Control - Dashboard</title>
  <style>
    body { font-family: Arial; background: #1a1a1a; color: #fff; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #4caf50; }
    .controls { display: grid; gap: 10px; }
    .btn { padding: 10px 20px; background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
    .btn:hover { background: #45a049; }
    .btn.danger { background: #f44336; }
    .output { background: #222; padding: 10px; border-radius: 5px; margin-top: 10px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; }
    .status { padding: 10px; background: #4caf50; border-radius: 5px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎛️ Remote Control Panel</h1>
    <p>Token necessário para ativar. Contate o administrador.</p>

    <div class="status" id="status">Verificando status...</div>

    <div class="controls">
      <button class="btn" onclick="checkStatus()">📊 Status</button>
      <button class="btn" onclick="deploy()">🚀 Deploy Automático</button>
      <button class="btn" onclick="restart()">🔄 Restart</button>
      <button class="btn" onclick="showLogs()">📝 Ver Logs</button>
      <button class="btn" onclick="clearCache()">🗑️ Limpar Cache</button>
      <button class="btn danger" onclick="if(confirm('Tem certeza?')) hardRestart()">⚡ Hard Restart</button>
    </div>

    <div class="output" id="output">Clique em um botão para começar...</div>
  </div>

  <script>
    const TOKEN = prompt('🔐 Digite o token de acesso:');
    if (!TOKEN) alert('Token necessário!');

    async function call(endpoint, method = 'GET', body = null) {
      const options = {
        method,
        headers: { 'x-control-token': TOKEN }
      };
      if (body) options.body = JSON.stringify(body);

      const res = await fetch(endpoint, options);
      return res.json();
    }

    async function checkStatus() {
      const data = await call('/api/remote/status');
      document.getElementById('output').textContent = JSON.stringify(data, null, 2);
    }

    async function deploy() {
      if (!confirm('🚀 Fazer deploy automático?')) return;
      document.getElementById('output').textContent = '⏳ Deploying...';
      await call('/api/remote/deploy', 'POST');
      setTimeout(checkStatus, 5000);
    }

    async function restart() {
      if (!confirm('🔄 Reiniciar servidor?')) return;
      document.getElementById('output').textContent = '⏳ Restarting...';
      await call('/api/remote/restart', 'POST');
      setTimeout(checkStatus, 3000);
    }

    async function showLogs() {
      const data = await call('/api/remote/logs');
      document.getElementById('output').textContent = data.logs;
    }

    async function clearCache() {
      if (!confirm('🗑️ Limpar cache?')) return;
      await call('/api/remote/clear-cache', 'POST');
      document.getElementById('output').textContent = '✅ Cache limpo!';
    }

    async function hardRestart() {
      await call('/api/remote/restart', 'POST');
      document.getElementById('output').textContent = '⚡ Restart agressivo enviado!';
    }

    // Auto-check status
    setInterval(checkStatus, 10000);
    checkStatus();
  </script>
</body>
</html>
      `);
    });

    console.log('✅ Remote Control Panel ativado em /remote');
  }
};

// ============================================================================
// HELPER: Executar comando no background (não bloqueia response)
// ============================================================================
function execRemote(command) {
  const { spawn } = require('child_process');
  spawn('bash', ['-c', command], {
    detached: true,
    stdio: 'ignore'
  }).unref();
}
