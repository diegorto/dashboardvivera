import pipedriveCache from '../../infrastructure/cache/PipedriveCache';

export class DashboardService {
  /**
   * Retorna KPIs do dashboard executivo
   * Lê diretamente do cache (nunca chama Pipedrive na request)
   */
  async getExecutiveDashboard() {
    const cache = pipedriveCache.getCache();
    const deals = cache.pipedrive.deals || [];

    const qualificados = deals.filter((d: any) => d.status === 'won').length;
    const emAndamento = deals.filter((d: any) => 
      d.status !== 'won' && d.status !== 'lost'
    ).length;
    const perdidos = deals.filter((d: any) => d.status === 'lost').length;

    return {
      timestamp: cache.timestamp,
      lastSync: pipedriveCache.getLastSyncTime(),
      kpis: {
        totalDeals: deals.length,
        qualificados,
        emAndamento,
        perdidos,
        taxa: deals.length > 0 ? ((qualificados / deals.length) * 100).toFixed(2) : '0'
      },
      cacheStatus: {
        hitTime: new Date(cache.timestamp).toISOString(),
        isRecent: Date.now() - cache.timestamp < 5 * 60 * 1000
      }
    };
  }

  /**
   * Retorna dados do SDR Panel
   * Lê do cache local
   */
  async getSdrPanel() {
    const cache = pipedriveCache.getCache();
    const persons = cache.pipedrive.persons || [];
    const deals = cache.pipedrive.deals || [];

    return {
      timestamp: cache.timestamp,
      lastSync: pipedriveCache.getLastSyncTime(),
      personas: persons.length,
      deals: deals.length,
      atividades: deals.reduce((sum: number, d: any) => 
        sum + (d.activities_count || 0), 0
      ),
      cacheStatus: {
        hitTime: new Date(cache.timestamp).toISOString(),
        isRecent: Date.now() - cache.timestamp < 5 * 60 * 1000
      }
    };
  }
}

export const dashboardService = new DashboardService();
