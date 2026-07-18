import fs from 'fs';
import path from 'path';

export interface CacheData {
  timestamp: number;
  pipedrive: {
    pipelines?: any[];
    deals?: any[];
    persons?: any[];
    activities?: any[];
  };
}

export class PipedriveCache {
  private cacheFile: string;
  private lastSyncFile: string;

  constructor() {
    const cacheDir = '/data/cache';
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    this.cacheFile = path.join(cacheDir, 'pipedrive-cache.json');
    this.lastSyncFile = path.join(cacheDir, 'pipedrive-last-sync.json');
  }

  getCache(): CacheData {
    try {
      if (fs.existsSync(this.cacheFile)) {
        return JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return { timestamp: 0, pipedrive: {} };
  }

  setCache(data: CacheData): void {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  getLastSyncTime(): number {
    try {
      if (fs.existsSync(this.lastSyncFile)) {
        return JSON.parse(fs.readFileSync(this.lastSyncFile, 'utf-8')).timestamp;
      }
    } catch (error) {
      console.error('Last sync read error:', error);
    }
    return 0;
  }

  updateLastSyncTime(): void {
    try {
      fs.writeFileSync(this.lastSyncFile, JSON.stringify({ timestamp: Date.now() }));
    } catch (error) {
      console.error('Last sync write error:', error);
    }
  }
}

export default new PipedriveCache();
