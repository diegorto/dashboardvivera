#!/usr/bin/env node

/**
 * 🎛️ Remote Client - Controla o VPS remotamente
 * Uso: node remote-client.js <comando> <vps-ip> [args]
 */

const http = require('http');
const https = require('https');

const CONTROL_TOKEN = process.env.CONTROL_TOKEN || 'dashboard-vivera-2026';

class RemoteVPSControl {
  constructor(vpsIp, port = 3000) {
    this.vpsIp = vpsIp;
    this.port = port;
    this.baseUrl = `http://${vpsIp}:${port}`;
  }

  async call(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);

      const options = {
        hostname: this.vpsIp,
        port: this.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'x-control-token': CONTROL_TOKEN,
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async status() {
    console.log('📊 Verificando status...');
    const data = await this.call('/api/remote/status');
    console.log('✅ Status:', JSON.stringify(data, null, 2));
    return data;
  }

  async deploy() {
    console.log('🚀 Iniciando deploy automático...');
    await this.call('/api/remote/deploy', 'POST');
    console.log('⏳ Deploy em progresso...');
    setTimeout(() => this.status(), 5000);
  }

  async restart() {
    console.log('🔄 Reiniciando servidor...');
    await this.call('/api/remote/restart', 'POST');
    console.log('⏳ Restart em progresso...');
    setTimeout(() => this.status(), 3000);
  }

  async logs() {
    console.log('📝 Recuperando logs...');
    const data = await this.call('/api/remote/logs');
    console.log(data.logs);
  }

  async health() {
    console.log('🏥 Verificando saúde detalhada...');
    const data = await this.call('/api/remote/health-detailed');
    console.log(JSON.stringify(data, null, 2));
  }

  async clearCache() {
    console.log('🗑️  Limpando cache...');
    await this.call('/api/remote/clear-cache', 'POST');
    console.log('✅ Cache limpo!');
  }

  async updateEnv(key, value) {
    console.log(`🔧 Atualizando ${key}...`);
    const data = await this.call('/api/remote/update-env', 'POST', { key, value });
    console.log('✅ Variável atualizada:', data);
  }

  async exec(command) {
    console.log(`⚙️  Executando: ${command}`);
    const data = await this.call('/api/remote/exec', 'POST', { command });
    console.log('Output:', data.output);
    if (data.error) console.error('Error:', data.error);
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const [command, vpsIp, ...rest] = args;

  if (!command || !vpsIp) {
    console.log(`
🎛️  Remote VPS Control Client

Uso:
  node remote-client.js <comando> <vps-ip> [args]

Comandos:
  status              - Verificar status
  deploy              - Deploy automático
  restart             - Reiniciar servidor
  logs                - Ver logs
  health              - Verificar saúde detalhada
  clear-cache         - Limpar cache
  update-env KEY VAL  - Atualizar variável de ambiente
  exec COMMAND        - Executar comando

Exemplos:
  node remote-client.js status 192.168.1.100
  node remote-client.js deploy 192.168.1.100
  node remote-client.js update-env PIPEDRIVE_TOKEN "abc123" 192.168.1.100
  node remote-client.js exec "pm2 status" 192.168.1.100
    `);
    process.exit(1);
  }

  try {
    const client = new RemoteVPSControl(vpsIp);

    switch (command) {
      case 'status':
        await client.status();
        break;
      case 'deploy':
        await client.deploy();
        break;
      case 'restart':
        await client.restart();
        break;
      case 'logs':
        await client.logs();
        break;
      case 'health':
        await client.health();
        break;
      case 'clear-cache':
        await client.clearCache();
        break;
      case 'update-env':
        const [key, value] = rest;
        if (!key || !value) {
          console.error('❌ update-env requer KEY e VALUE');
          process.exit(1);
        }
        await client.updateEnv(key, value);
        break;
      case 'exec':
        const cmd = rest.join(' ');
        if (!cmd) {
          console.error('❌ exec requer um comando');
          process.exit(1);
        }
        await client.exec(cmd);
        break;
      default:
        console.error(`❌ Comando desconhecido: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
