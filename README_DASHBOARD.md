# 📊 Dashboard WhatsApp Analytics

**A fully automated, production-ready analytics dashboard for WhatsApp business metrics** — with complete remote VPS control and zero manual intervention.

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🎯 What Is This?

Your complete WhatsApp analytics solution:

- 📈 **Real-time Dashboard** - Track messages, calls, effectiveness, and conversion rates
- 🤖 **100% Automated** - Runs 24/7 without any manual intervention
- 🎛️ **Remote Control** - Manage your VPS from anywhere (web UI or CLI)
- 🔄 **Auto-Deploy** - Push code → Get deployed in seconds
- 🔐 **Secure** - Token-based authentication on all endpoints
- 📱 **Responsive** - Works on desktop, tablet, and mobile
- ⚡ **Fast** - Real-time updates every 30 seconds

---

## ⚡ Quick Start (5 minutes)

### 1. Start Locally
```bash
cd /home/user/dashboardvivera
npm install
npm start
```
Then visit: **http://localhost:3000/dashboard/whatsapp**

### 2. Deploy to VPS (Production)
```bash
ssh root@187.77.249.55
cd /root && git clone https://github.com/diegorto/dashboardvivera.git
cd dashboardvivera && bash DEPLOY_VPS.sh
```
Dashboard: **http://187.77.249.55:3000/dashboard/whatsapp**

### 3. Control Remotely
```bash
# Check status
node remote-client.js status 187.77.249.55

# Deploy new code
node remote-client.js deploy 187.77.249.55

# View logs
node remote-client.js logs 187.77.249.55
```

For detailed setup, see **[QUICK_START.md](QUICK_START.md)**

---

## 🎨 Dashboard Features

### 📊 4 KPI Cards
- Total Messages Sent
- Average Response Time
- Message Effectiveness Rate
- Lead Conversion Rate

### 📈 Interactive Charts
- **Message Timing** - When do customers message?
- **Calls Per Hour** - Call volume distribution
- **Message Types** - Breakdown of message categories
- **Compliance Gauge** - Script compliance percentage

### 📋 Data Tables
- **Message Effectiveness** - Which messages convert best
- **Recent Calls** - Last 20 calls with durations
- **SDR Performance** - Performance by team member
- **Paginated** - 20 items per page, sortable

### 🧠 Auto Insights
- Automatically generated insights from your data
- Trends and anomalies highlighted
- Updates every 30 seconds

### 🔗 N8N Integration
- Script compliance monitoring
- Automated analysis from N8N webhooks
- Real-time compliance tracking
- Issue detection and alerts

---

## 🎛️ Remote Control System

### Web Dashboard
Visit **`http://187.77.249.55:3000/remote`** (requires token)

Buttons for:
- 📊 Check Status
- 🚀 Deploy Latest Code
- 🔄 Restart Server
- 📝 View Logs
- 🗑️ Clear Cache

### CLI Tool
```bash
node remote-client.js <command> <vps-ip> [args]

# Examples:
node remote-client.js status 187.77.249.55
node remote-client.js deploy 187.77.249.55
node remote-client.js restart 187.77.249.55
node remote-client.js logs 187.77.249.55
node remote-client.js health 187.77.249.55
node remote-client.js clear-cache 187.77.249.55
node remote-client.js update-env PIPEDRIVE_TOKEN "abc123" 187.77.249.55
```

### REST API
```bash
# Status
curl -H "x-control-token: dashboard-vivera-2026" \
  http://187.77.249.55:3000/api/remote/status

# Deploy
curl -X POST -H "x-control-token: dashboard-vivera-2026" \
  http://187.77.249.55:3000/api/remote/deploy

# Logs
curl -H "x-control-token: dashboard-vivera-2026" \
  http://187.77.249.55:3000/api/remote/logs

# More endpoints documented in REMOTE_CONTROL_GUIDE.md
```

---

## 🤖 Automation

Everything runs automatically on a schedule:

| Task | Schedule | Purpose |
|------|----------|---------|
| **Data Sync** | Every 5 min | Update dashboard with latest data |
| **Health Check** | Every 5 min | Auto-restart if server is down |
| **Script Analysis** | Daily 6:05 PM | N8N compliance check |
| **Cache Cleanup** | Daily 2:00 AM | Remove old data (7-day retention) |
| **Auto-Restart** | On crash | PM2 restarts immediately |

**You don't do any of this** — it all happens automatically! ✨

---

## 📁 Project Structure

```
dashboardvivera/
├── 📖 QUICK_START.md               # ← START HERE!
├── 📋 PROJECT_STATUS.md            # Complete status overview
├── 📚 REMOTE_CONTROL_GUIDE.md      # API reference
├── 🤖 AUTOMATION.md                # How automation works
│
├── 🚀 DEPLOY_VPS.sh                # One-command deployment
├── 🔧 remote-client.js             # CLI control tool
├── 🧪 test-remote-control.sh       # Verification tests
│
├── 📄 server.js                    # Main Express app
├── ⚙️ setup-automation.js          # Initial setup
├── 📦 package.json                 # Dependencies
│
├── 🎛️ src/
│   ├── remote-control.js           # Remote API
│   ├── auto-scheduler.js           # Cron jobs
│   ├── n8n-webhook.js              # Webhook receiver
│   └── notifications.js            # Alerts
│
├── 🎨 views/ & public/
│   ├── dashboard-whatsapp.html     # Dashboard HTML
│   ├── css/dashboard-whatsapp.css  # Styling
│   ├── js/dashboard-whatsapp.js    # Dashboard logic
│   └── js/auto-updater.js          # Real-time updates
│
└── 🐳 whatsapp-monitor/            # WhatsApp service
```

---

## 🚀 Deployment

### Development
```bash
npm install
npm start
# → http://localhost:3000
```

### Production (One-Time Setup)
```bash
ssh root@187.77.249.55
git clone https://github.com/diegorto/dashboardvivera.git
cd dashboardvivera
bash DEPLOY_VPS.sh
# → Dashboard is now live 24/7
```

### Updates (Repeat This)
```bash
# From your local machine:
git push origin claude/dashboard-structure-exploration-53agnp
node remote-client.js deploy 187.77.249.55
# → New code is live in seconds
```

---

## 🔐 Security

### Authentication
- All remote control endpoints require: `x-control-token: dashboard-vivera-2026`
- Default token is changeable via `update-env`

### Whitelisted Commands
Only safe commands can be executed via the exec endpoint:
- `pm2 status`, `pm2 logs`, `pm2 restart`
- `npm install`, `git pull`, `git status`
- `ls -la`, `pwd`, `whoami`, `df -h`

### Production Hardening
- Change default token immediately
- Use HTTPS reverse proxy (Nginx/Traefik)
- Restrict port 3000 to local network
- Enable firewall rules

---

## 📊 API Endpoints

### Remote Control
- `GET /api/remote/status` - System status
- `POST /api/remote/deploy` - Deploy code
- `POST /api/remote/restart` - Restart server
- `GET /api/remote/logs` - View logs
- `GET /api/remote/health-detailed` - Full health info
- `POST /api/remote/sync` - Force sync
- `POST /api/remote/clear-cache` - Clear cache
- `POST /api/remote/update-env` - Update config
- `POST /api/remote/exec` - Execute command
- `GET /remote` - Web dashboard

### Dashboard Data
- `GET /api/whatsapp/stats` - KPI statistics
- `GET /api/whatsapp/calls` - Call history
- `GET /api/whatsapp/lead-timing` - Timing analysis
- `GET /api/whatsapp/patterns` - Usage patterns
- `GET /api/whatsapp/message-types` - Message breakdown
- `GET /api/whatsapp/script-compliance` - N8N compliance

### Health & Status
- `GET /api/health` - Health check
- `GET /api/cache-status` - Cache info

---

## 🧪 Verification

Test that everything works:
```bash
bash test-remote-control.sh 187.77.249.55

# Tests:
# ✓ Server connectivity
# ✓ API endpoints
# ✓ Health checks
# ✓ Security (token validation)
# ✓ Web dashboard
# ✓ Command execution
```

---

## 📞 Documentation

- **[QUICK_START.md](QUICK_START.md)** - Getting started (5 min)
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Complete status
- **[REMOTE_CONTROL_GUIDE.md](REMOTE_CONTROL_GUIDE.md)** - API reference
- **[AUTOMATION.md](AUTOMATION.md)** - How automation works
- **[DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)** - Current deployment

---

## 🆘 Troubleshooting

### Dashboard won't load?
```bash
node remote-client.js status 187.77.249.55
node remote-client.js logs 187.77.249.55
node remote-client.js health 187.77.249.55
```

### Want to SSH to VPS?
```bash
ssh root@187.77.249.55
pm2 status      # See all apps
pm2 logs        # View logs
pm2 restart all # Restart everything
```

### Deploy failed?
```bash
node remote-client.js logs 187.77.249.55
# Check what went wrong, then:
node remote-client.js deploy 187.77.249.55
```

### Need to change a setting?
```bash
# Update any environment variable and restart:
node remote-client.js update-env PIPEDRIVE_TOKEN "new-token" 187.77.249.55
```

---

## ✨ Key Features

| Feature | Status | Details |
|---------|--------|---------|
| WhatsApp Dashboard | ✅ | `/dashboard/whatsapp` |
| Remote Control Web UI | ✅ | `/remote` |
| Remote Control API | ✅ | `/api/remote/*` |
| Remote Control CLI | ✅ | `remote-client.js` |
| Auto-Deploy | ✅ | One command deploy |
| Real-Time Updates | ✅ | Every 30 seconds |
| Auto-Restart | ✅ | On crash |
| Health Monitoring | ✅ | Every 5 minutes |
| Cron Automation | ✅ | 4 scheduled tasks |
| N8N Integration | ✅ | Webhook receiver |
| Token Auth | ✅ | All endpoints secured |
| Logging | ✅ | Persistent with rotation |
| PM2 Management | ✅ | Process control |

---

## 🎯 Use Cases

### I made changes to the code
```bash
git push
node remote-client.js deploy 187.77.249.55
```

### Server is slow
```bash
node remote-client.js clear-cache 187.77.249.55
node remote-client.js restart 187.77.249.55
```

### I need to check what's happening
```bash
node remote-client.js logs 187.77.249.55
node remote-client.js health 187.77.249.55
```

### I want to change a setting
```bash
node remote-client.js update-env KEY VALUE 187.77.249.55
```

### I need to run a specific command
```bash
node remote-client.js exec "your-command" 187.77.249.55
```

---

## 🎊 What You Get

✅ Complete WhatsApp analytics dashboard  
✅ Real-time metrics and charts  
✅ Fully automated (zero manual work)  
✅ Remote control from anywhere  
✅ One-command deployment  
✅ 24/7 auto-restart capability  
✅ Comprehensive documentation  
✅ Production-ready code  

---

## 🚀 Next Steps

1. **Read**: [QUICK_START.md](QUICK_START.md)
2. **Deploy**: Run `bash DEPLOY_VPS.sh` on your VPS
3. **Control**: Use `node remote-client.js` from your machine
4. **Monitor**: Check `http://187.77.249.55:3000/dashboard/whatsapp`
5. **Relax**: Everything else is automatic! ✨

---

## 📄 License

MIT

---

## 👨‍💻 Technical Stack

- **Runtime:** Node.js + Express
- **Frontend:** Vanilla JavaScript + HTML/CSS
- **Charts:** Chart.js
- **Process Manager:** PM2
- **Scheduling:** Node-cron
- **Process:** Systemd (backup)
- **Integration:** N8N Webhooks, Pipedrive API, WhatsApp Monitor

---

## 📈 Architecture

```
┌─────────────────────────────────────────┐
│         Client Browser                  │
│   (Dashboard + Remote Control)          │
└────────────────────┬────────────────────┘
                     │ HTTP/HTTPS
┌────────────────────▼────────────────────┐
│    Express Server (Port 3000)           │
│  ┌──────────────────────────────────┐   │
│  │ Dashboard Routes & API           │   │
│  │ Remote Control Endpoints         │   │
│  │ Webhook Receivers                │   │
│  └──────────────────────────────────┘   │
└────────────┬──────────────────┬──────────┘
             │ Cron Jobs        │ Webhooks
             │                  │
    ┌────────▼────────┐   ┌─────▼──────────┐
    │  PM2 Scheduler  │   │ N8N / Monitor  │
    │  (Every 5 min)  │   │ (Webhooks)     │
    └────────────────┘   └────────────────┘
```

---

## 💡 How It Works

1. **Your browser** → Connects to dashboard at `/dashboard/whatsapp`
2. **Dashboard** → Auto-updates every 30 seconds with latest data
3. **Cron jobs** → Sync data, run compliance checks, monitor health
4. **N8N** → Sends compliance reports via webhook
5. **PM2** → Keeps everything running 24/7, restarts on crash
6. **Remote Control** → You can manage everything from anywhere

**Everything happens automatically. You just monitor.** 🚀

---

**Ready to start?** → Go to **[QUICK_START.md](QUICK_START.md)**
