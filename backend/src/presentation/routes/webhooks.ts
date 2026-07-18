import { Router, Request, Response } from 'express';
import pipedriveCache from '../../infrastructure/cache/PipedriveCache';

const router = Router();

/**
 * POST /api/webhooks/pipedrive
 * Recebe notificações do Pipedrive e atualiza o cache local
 */
router.post('/pipedrive', async (req: Request, res: Response) => {
  try {
    console.log('🔔 Webhook Pipedrive recebido:', req.body);
    
    // Diego pode usar isso com webhook de mudanças do Pipedrive
    // Por enquanto, apenas confirma recebimento
    
    // Atualizar timestamp para indicar que houve mudança
    const cache = pipedriveCache.getCache();
    cache.timestamp = Date.now();
    pipedriveCache.setCache(cache);
    
    res.json({ success: true, message: 'Webhook recebido' });
  } catch (error) {
    console.error('Erro ao processar webhook Pipedrive:', error);
    res.status(500).json({ success: false, error: error });
  }
});

export default router;
