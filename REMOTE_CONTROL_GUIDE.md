# 🎛️ Remote Control Guide
**Control your VPS remotely via API** — No SSH needed!

## 🚀 Quick Start

### Web Dashboard
Access the remote control web interface:
```
http://187.77.249.55:3000/remote
```
- You'll be prompted for the **Control Token**
- Default token: `dashboard-vivera-2026`
- Provides buttons for: Status, Deploy, Restart, Logs, Clear Cache

### CLI Client
Use the `remote-client.js` tool to control from your machine:

```bash
# Check server status
node remote-client.js status 187.77.249.55

# Deploy latest code
node remote-client.js deploy 187.77.249.55

# Restart server
node remote-client.js restart 187.77.249.55

# View logs
node remote-client.js logs 187.77.249.55

# Check detailed health
node remote-client.js health 187.77.249.55

# Clear cache
node remote-client.js clear-cache 187.77.249.55

# Update environment variable
node remote-client.js update-env KEY VALUE 187.77.249.55

# Execute whitelisted command
node remote-client.js exec "pm2 status" 187.77.249.55
```

## 🔐 Authentication
All requests require the `x-control-token` header with value: `dashboard-vivera-2026`

To use a different token, set the environment variable:
```bash
export CONTROL_TOKEN="your-custom-token"
node remote-client.js status 187.77.249.55
```

## 📡 REST API Endpoints

### GET `/api/remote/status`
Get current system status and uptime.
```bash
curl -H "x-control-token: dashboard-vivera-2026" http://187.77.249.55:3000/api/remote/status
```

### POST `/api/remote/deploy`
Deploy latest code from git.
```bash
curl -X POST -H "x-control-token: dashboard-vivera-2026" http://187.77.249.55:3000/api/remote/deploy
```
This will:
- Kill existing processes
- Fetch latest code from git
- Install dependencies
- Restart PM2

### POST `/api/remote/restart`
Quick server restart.
```bash
curl -X POST -H "x-control-token: dashboard-vivera-2026" http://187.77.249.55:3000/api/remote/restart
```

### GET `/api/remote/logs`
Get last 50 lines of logs.
```bash
curl -H "x-control-token: dashboard-vivera-2026" http://187.77.249.55:3000/api/remote/logs
```

### GET `/api/remote/health-detailed`
Get detailed system health information.
```bash
curl -H "x-control-token: dashboard-vivera-2026" http://187.77.249.55:3000/api/remote/health-detailed
```

### POST `/api/remote/sync`
Force data synchronization.
```bash
curl -X POST -H "x-control-token: dashboard-vivera-2026" http://187.77.249.55:3000/api/remote/sync
```

### POST `/api/remote/clear-cache`
Clear all cached data.
```bash
curl -X POST -H "x-control-token: dashboard-vivera-2026" http://187.77.249.55:3000/api/remote/clear-cache
```

### POST `/api/remote/update-env`
Update environment variable and restart.
```bash
curl -X POST \
  -H "x-control-token: dashboard-vivera-2026" \
  -H "Content-Type: application/json" \
  -d '{"key":"PIPEDRIVE_TOKEN","value":"abc123"}' \
  http://187.77.249.55:3000/api/remote/update-env
```

### POST `/api/remote/exec`
Execute whitelisted command (for advanced users).

**Whitelisted commands:**
- `pm2 status`, `pm2 logs`, `pm2 restart`
- `npm install`, `git pull`, `git status`
- `cd /root/dashboardvivera`
- `ls -la`, `pwd`, `whoami`, `df -h`
- `ps aux | grep node`
- `curl http://localhost:3000/api/health`

```bash
curl -X POST \
  -H "x-control-token: dashboard-vivera-2026" \
  -H "Content-Type: application/json" \
  -d '{"command":"pm2 logs"}' \
  http://187.77.249.55:3000/api/remote/exec
```

## 🔄 Deployment Workflow

### 1. Make changes locally
```bash
git add .
git commit -m "Your changes"
git push -u origin claude/dashboard-structure-exploration-53agnp
```

### 2. Deploy to VPS
```bash
node remote-client.js deploy 187.77.249.55
```

### 3. Verify deployment
```bash
node remote-client.js status 187.77.249.55
```

### 4. Check logs if needed
```bash
node remote-client.js logs 187.77.249.55
```

## ⚙️ Configuration

### Changing the Control Token
On the VPS:
1. SSH: `ssh root@187.77.249.55`
2. Edit `.env`: `nano /root/dashboardvivera/.env`
3. Change `CONTROL_TOKEN=your-new-token`
4. Restart: `pm2 restart all`

Or use the remote update-env command:
```bash
node remote-client.js update-env CONTROL_TOKEN "new-token" 187.77.249.55
```

### Port Configuration
Default: 3000

To change, update `.env`:
```bash
node remote-client.js update-env PORT 3001 187.77.249.55
```

## 🆘 Troubleshooting

### Connection Timeout
- Check VPS is online: ping 187.77.249.55
- Verify firewall allows port 3000
- Check if PM2 is still running: `node remote-client.js exec "pm2 status" 187.77.249.55`

### Deploy Fails
- Check recent logs: `node remote-client.js logs 187.77.249.55`
- Verify git branch is correct on VPS
- Check npm install isn't hanging (run with timeout)

### Wrong Token
- Verify token in `.env` on VPS
- Use correct token in all requests
- Reset to default: `CONTROL_TOKEN=dashboard-vivera-2026`

## 📊 Monitoring

### Auto Health Check
The VPS automatically runs health checks every 5 minutes via cron:
```bash
curl -s http://localhost:3000/api/health
```

If unhealthy, PM2 auto-restarts the services.

### Manual Health Check
```bash
node remote-client.js health 187.77.249.55
```

## 🎯 Common Use Cases

### I pushed code and want to deploy immediately
```bash
node remote-client.js deploy 187.77.249.55
```

### The server seems slow, I want to restart it
```bash
node remote-client.js restart 187.77.249.55
```

### I need to change an API token in production
```bash
node remote-client.js update-env PIPEDRIVE_TOKEN "new-token" 187.77.249.55
```

### I want to see what's happening
```bash
node remote-client.js logs 187.77.249.55
```

### I want to run a specific command
```bash
node remote-client.js exec "ls -la" 187.77.249.55
```

## 🔒 Security Notes

1. **Keep your token secret** - Anyone with the token can control your VPS
2. **Use environment variables** - Don't hardcode tokens in scripts
3. **Limited command whitelist** - Only safe commands can be executed via exec
4. **Token in requests** - Always use HTTPS in production (or reverse proxy)
5. **Firewall** - Restrict port 3000 access to trusted IPs if possible

## 📝 Advanced Usage

### Integrate with CI/CD
```bash
# In your CI/CD pipeline
curl -X POST \
  -H "x-control-token: $CONTROL_TOKEN" \
  http://187.77.249.55:3000/api/remote/deploy
```

### Monitor in a loop
```bash
while true; do
  node remote-client.js status 187.77.249.55
  sleep 60
done
```

### Parse JSON response
```bash
STATUS=$(node remote-client.js status 187.77.249.55 | tail -1)
echo $STATUS | jq '.uptime'
```
