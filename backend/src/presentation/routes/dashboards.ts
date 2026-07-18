import { Router, Request, Response } from 'express';
import { dashboardService } from '../../application/services/DashboardService';

const router = Router();

/**
 * GET /api/dashboard/executive
 * Retorna KPIs do dashboard executivo (lê do cache local)
 */
router.get('/executive', async (req: Request, res: Response) => {
  try {
    const data = await dashboardService.getExecutiveDashboard();
    res.json(data);
  } catch (error) {
    console.error('Erro ao carregar executive dashboard:', error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

/**
 * GET /api/dashboard/sdr-panel
 * Retorna dados do SDR panel (lê do cache local)
 */
router.get('/sdr-panel', async (req: Request, res: Response) => {
  try {
    const data = await dashboardService.getSdrPanel();
    res.json(data);
  } catch (error) {
    console.error('Erro ao carregar SDR panel:', error);
    res.status(500).json({ error: 'Erro ao carregar SDR panel' });
  }
});

/**
 * GET /api/dashboard/cache-status
 * Retorna status do cache (útil pra debug)
 */
router.get('/cache-status', (req: Request, res: Response) => {
  const cache = require('../../infrastructure/cache/PipedriveCache').default;
  res.json({
    cacheSize: JSON.stringify(cache.getCache()).length,
    lastSync: cache.getLastSyncTime(),
    cacheTimestamp: cache.getCache().timestamp,
    isFresh: Date.now() - cache.getCache().timestamp < 5 * 60 * 1000
  });
});

export default router;
