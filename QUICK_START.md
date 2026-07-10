# 🚀 Quick Start Guide - Dashboard WhatsApp Analytics

**Everything is already built and automated!** This guide explains what you have and how to use it.

## 📦 What's Included

Your Dashboard now has:

1. **WhatsApp Analytics Dashboard** - Full analytics at `/dashboard/whatsapp`
2. **Remote Control Panel** - Manage VPS from anywhere at `/remote`
3. **Automation System** - Runs 24/7 without your intervention
4. **Deploy Scripts** - One-click deployment to production
5. **CLI Tools** - Control everything from terminal

## ⚡ 5-Minute Setup

### Step 1: Verify Local Environment
```bash
cd /home/user/dashboardvivera
npm install
npm start
```
This starts the server locally at `http://localhost:3000`

### Step 2: Access the Dashboard
Open in your browser:
```
http://localhost:3000/dashboard/whatsapp
```

You should see:
- 4 KPI cards (top metrics)
- Message timing chart
- Calls per hour chart
- Message effectiveness table
- Recent calls table
- Script compliance section
- Automatic insights

### Step 3: Access Remote Control
```
http://localhost:3000/remote
```
Enter the control token: `dashboard-vivera-2026`

You can now:
- ✅ Check server status
- 🚀 Deploy new code
- 🔄 Restart server
- 📝 View logs
- 🗑️ Clear cache

## 🌐 Production Deployment to VPS

### One-Time Setup
1. SSH into your VPS: `ssh root@187.77.249.55`
2. Download and run the deploy script:
   ```bash
   cd /root
   git clone https://github.com/diegorto/dashboardvivera.git
   cd dashboardvivera
   bash /root/dashboardvivera/DEPLOY_VPS.sh
   ```

That's it! The script will:
- ✅ Stop any existing processes
- ✅ Install dependencies
- ✅ Configure PM2 for auto-restart
- ✅ Set up health checks (every 5 min)
- ✅ Start the server (stays running 24/7)

### After Deployment
Your VPS is now at: `http://187.77.249.55:3000`

- Dashboard: `http://187.77.249.55:3000/dashboard/whatsapp`
- Remote Control: `http://187.77.249.55:3000/remote`
- Token: `dashboard-vivera-2026`

## 📱 Use Remote Control to Manage VPS

### Via Web Interface
1. Go to `http://187.77.249.55:3000/remote`
2. Enter token: `dashboard-vivera-2026`
3. Click buttons to:
   - 📊 Check Status
   - 🚀 Deploy (pulls latest code and restarts)
   - 🔄 Restart
   - 📝 View Logs
   - 🗑️ Clear Cache

### Via CLI (from your machine)
```bash
# Check server is running
node remote-client.js status 187.77.249.55

# Deploy latest code
node remote-client.js deploy 187.77.249.55

# View logs
node remote-client.js logs 187.77.249.55

# Restart
node remote-client.js restart 187.77.249.55

# Update environment variable
node remote-client.js update-env PIPEDRIVE_TOKEN "abc123" 187.77.249.55
```

For more commands, see: [REMOTE_CONTROL_GUIDE.md](REMOTE_CONTROL_GUIDE.md)

## 🔄 The Workflow You Asked For

You wanted: **"Do everything automatically, I don't want to do anything manually"**

Here's how it works:

### Making Changes
```bash
# 1. Make your changes locally
git add .
git commit -m "Your change description"
git push

# 2. Deploy with one command
node remote-client.js deploy 187.77.249.55

# 3. Done! Changes are live in seconds
```

### Server Crashes?
- **Automatic!** PM2 restarts it immediately
- Health check runs every 5 minutes
- If server is down, cron job restarts it

### Data Out of Sync?
- **Automatic!** Cron job syncs data every 5 minutes
- N8N script compliance checks daily at 6:05 PM
- Cache is cleared automatically daily at 2 AM

### Need Real-Time Stats?
- Dashboard auto-updates every 30 seconds
- No page refresh needed

## 📊 Dashboard Features

### KPI Cards (Top Section)
- Total Messages
- Average Response Time
- Message Effectiveness
- Lead Conversion Rate

### Charts
- **Message Timing**: When are people messaging?
- **Calls per Hour**: Call volume throughout day
- **Message Type Distribution**: Pie chart of message types

### Tables
- **Message Effectiveness**: Which messages work best
- **Recent Calls**: Last 20 calls with durations
- **Paginated Tables**: 20 items per page, easy navigation

### Script Compliance (N8N Integration)
- Gauge showing compliance percentage
- Trend chart over time
- Issues detected
- Per-SDR compliance breakdown

### Auto Insights
- Automatically generated insights based on data
- Highlights trends and problems
- Updates every 30 seconds

## 🔐 Security

Default control token: `dashboard-vivera-2026`

To change:
1. Via remote control:
   ```bash
   node remote-client.js update-env CONTROL_TOKEN "your-new-token" 187.77.249.55
   ```
2. Or SSH and edit `.env` then restart

## 🆘 Troubleshooting

### Dashboard not showing data?
```bash
# 1. Check server status
node remote-client.js status 187.77.249.55

# 2. View logs
node remote-client.js logs 187.77.249.55

# 3. Check health
node remote-client.js health 187.77.249.55

# 4. If needed, restart
node remote-client.js restart 187.77.249.55
```

### Can't connect to remote control?
- Check VPS is running: `ping 187.77.249.55`
- Check token is correct: `dashboard-vivera-2026`
- Try SSH: `ssh root@187.77.249.55`
- Check PM2: `pm2 status` (after SSH)
- View logs: `pm2 logs` (after SSH)

### Want to manually check VPS?
SSH into it:
```bash
ssh root@187.77.249.55

# Then inside:
pm2 status          # See all apps
pm2 logs            # See logs
pm2 restart all     # Restart everything
pm2 stop all        # Stop everything
cd /root/dashboardvivera && git status  # Check code
```

## 📚 Detailed Documentation

For more detailed information:

- **Automation**: See [AUTOMATION.md](AUTOMATION.md)
- **Remote Control**: See [REMOTE_CONTROL_GUIDE.md](REMOTE_CONTROL_GUIDE.md)
- **Deployment Status**: See [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md)
- **Testing**: Run `bash test-remote-control.sh 187.77.249.55`

## 🎯 Common Tasks

### I pushed new code and want to deploy
```bash
node remote-client.js deploy 187.77.249.55
```

### I need to change the Pipedrive API token
```bash
node remote-client.js update-env PIPEDRIVE_TOKEN "new-token-here" 187.77.249.55
```

### The dashboard looks slow
```bash
# Clear cache and restart
node remote-client.js clear-cache 187.77.249.55
node remote-client.js restart 187.77.249.55
```

### I want to see what's happening
```bash
# View live logs
node remote-client.js logs 187.77.249.55

# Or SSH and use PM2
ssh root@187.77.249.55
pm2 logs --lines 100
```

### I want to see database stats
```bash
# Get detailed health info
node remote-client.js health 187.77.249.55
```

## ✅ Verification Checklist

After deployment, verify everything works:

```bash
# 1. Test all endpoints
bash test-remote-control.sh 187.77.249.55

# 2. Or manually:
node remote-client.js status 187.77.249.55        # Should show uptime
node remote-client.js logs 187.77.249.55          # Should show recent logs
node remote-client.js health 187.77.249.55        # Should show system healthy
```

## 🎉 That's It!

Your dashboard is now:
- ✅ **Running 24/7** without your intervention
- ✅ **Auto-restarting** if it crashes
- ✅ **Syncing data** every 5 minutes
- ✅ **Checking compliance** daily
- ✅ **Rotated logs** to prevent disk full
- ✅ **Fully remote-controlled** from your machine

You never have to SSH into the VPS again unless you want to!

## 🚀 Next Steps

1. **Test locally**: `npm start` and visit dashboard
2. **Test remote**: Visit `http://187.77.249.55:3000/remote`
3. **Run verification**: `bash test-remote-control.sh 187.77.249.55`
4. **Make changes**: Commit and use `node remote-client.js deploy`
5. **Monitor**: Watch logs with `node remote-client.js logs 187.77.249.55`

Happy coding! 🎊
