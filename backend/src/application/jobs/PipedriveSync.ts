import axios from 'axios';
import pipedriveCache from '../../infrastructure/cache/PipedriveCache';

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export class PipedriveSyncJob {
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    console.log('🔄 Starting Pipedrive sync job (5 min interval)');
    this.sync(); // Sync immediately on start
    this.intervalId = setInterval(() => this.sync(), SYNC_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Pipedrive sync job stopped');
    }
  }

  private async sync() {
    try {
      console.log(`[${new Date().toISOString()}] 🔄 Syncing Pipedrive...`);
      
      const baseUrl = 'https://api.pipedrive.com/v1';
      const headers = { 'api_token': PIPEDRIVE_API_KEY };

      const [pipelines, deals, persons] = await Promise.all([
        axios.get(`${baseUrl}/pipelines?api_token=${PIPEDRIVE_API_KEY}`),
        axios.get(`${baseUrl}/deals?limit=500&api_token=${PIPEDRIVE_API_KEY}`),
        axios.get(`${baseUrl}/persons?limit=500&api_token=${PIPEDRIVE_API_KEY}`)
      ]);

      const cacheData = {
        timestamp: Date.now(),
        pipedrive: {
          pipelines: pipelines.data.data || [],
          deals: deals.data.data || [],
          persons: persons.data.data || [],
          activities: []
        }
      };

      pipedriveCache.setCache(cacheData);
      pipedriveCache.updateLastSyncTime();
      console.log('✅ Pipedrive sync completed');
    } catch (error) {
      console.error('❌ Pipedrive sync error:', error);
    }
  }
}

export const pipedriveSync = new PipedriveSyncJob();
