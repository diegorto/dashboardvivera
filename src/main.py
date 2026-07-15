import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from src.core.logger import setup_logger
from src.core.config import settings
from src.core.database import init_db
from src.orchestrator import SyncOrchestrator

logger = setup_logger(__name__)

async def run_sync_cycle():
    """Executa um ciclo completo de sincronização"""
    try:
        logger.info("=" * 80)
        logger.info("INICIANDO CICLO DE SINCRONIZAÇÃO")
        logger.info(f"Timestamp: {datetime.utcnow().isoformat()}")
        logger.info("=" * 80)
        
        orchestrator = SyncOrchestrator()
        result = await orchestrator.execute_sync()
        
        logger.info("=" * 80)
        logger.info(f"CICLO CONCLUÍDO: {result.get('status')}")
        logger.info(f"Duração: {result.get('duration_seconds')}s")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Erro durante ciclo de sincronização: {str(e)}", exc_info=True)

def run_scheduled_sync():
    """Wrapper para executar sync em thread"""
    asyncio.run(run_sync_cycle())

def main():
    """Função principal - inicializa o agente"""
    logger.info("Iniciando Agente Autônomo de Sincronização")
    logger.info(f"Versão: 1.0.0")
    logger.info(f"Configuração: {settings.CLAIRIS_URL}")
    
    # Initialize database
    try:
        init_db()
        logger.info("Banco de dados inicializado")
    except Exception as e:
        logger.error(f"Erro ao inicializar banco de dados: {str(e)}")
        raise
    
    # Setup scheduler
    scheduler = BackgroundScheduler()
    
    # Parse cron schedule
    cron_parts = settings.SYNC_SCHEDULE.split()
    if len(cron_parts) == 5:
        minute, hour, day, month, dow = cron_parts
        
        logger.info(f"Agendando sincronização: {settings.SYNC_SCHEDULE}")
        scheduler.add_job(
            run_scheduled_sync,
            'cron',
            minute=minute,
            hour=hour,
            day=day,
            month=month,
            day_of_week=dow,
            id='sync_job'
        )
    
    # Start scheduler
    scheduler.start()
    logger.info("Scheduler iniciado")
    
    # Keep running
    try:
        logger.info("Agente em execução. Aguardando eventos...")
        while True:
            asyncio.sleep(60)
    except KeyboardInterrupt:
        logger.info("Encerrando agente...")
        scheduler.shutdown()
        logger.info("Agente finalizado")

if __name__ == "__main__":
    main()
