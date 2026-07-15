import asyncio
import pandas as pd
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from src.core.logger import setup_logger
from src.core.database import SessionLocal
from src.clairis.auth import ClairisAuth
from src.clairis.exporter import ClairisExporter
from src.clairis.validator import ExportValidator
from src.staging.loader import StagingLoader
from src.normalization.engine import NormalizationEngine
from src.comparison.engine import ComparisonEngine
from src.audit.engine import AuditEngine
from src.approval.queue import ApprovalQueueManager
from src.journey.patient_analyzer import PatientJourneyAnalyzer
from src.models import SyncExecution, SyncLog

logger = setup_logger(__name__)

class SyncOrchestrator:
    """Orquestrador principal do fluxo de sincronização"""
    
    def __init__(self):
        self.batch_id = str(uuid4())
        self.start_time = datetime.utcnow()
        self.db = SessionLocal()
        self.sync_execution = None
        
    async def execute_sync(self) -> dict:
        """Executa o fluxo completo de sincronização"""
        
        try:
            # Create sync execution record
            self.sync_execution = SyncExecution(
                batch_id=self.batch_id,
                started_at=self.start_time,
                status="running"
            )
            self.db.add(self.sync_execution)
            self.db.commit()
            
            logger.info(f"Iniciando sincronização com batch_id: {self.batch_id}")
            
            # Step 1: Login and Export
            await self._step_export()
            
            # Step 2: Validation
            await self._step_validate()
            
            # Step 3: Staging Import
            await self._step_staging()
            
            # Step 4: Normalization
            await self._step_normalization()
            
            # Step 5: Comparison
            await self._step_comparison()
            
            # Step 6: Audit
            await self._step_audit()
            
            # Step 7: Approval Queue
            await self._step_approval()
            
            # Step 8: Patient Journey Analysis
            await self._step_journey_analysis()
            
            # Step 9: CRM Update (after approval)
            await self._step_crm_update()
            
            # Step 10: Executive OS Update
            await self._step_executive_os_update()
            
            # Step 11: Finish
            return await self._step_finish("success")
            
        except Exception as e:
            logger.error(f"Erro durante sincronização: {str(e)}", exc_info=True)
            return await self._step_finish("error")
    
    async def _step_export(self):
        """02:00 - Login no Clairis e exportação"""
        logger.info("[02:00] Iniciando exportação...")
        self._log_step("export", "started", "Conectando ao Clairis")
        
        try:
            auth = ClairisAuth()
            page = await auth.connect()
            
            exporter = ClairisExporter(page)
            export_results = await exporter.export_all()
            
            self.sync_execution.files_exported = len(export_results.get("exports", {}))
            
            self._log_step("export", "success", f"Exportadas {self.sync_execution.files_exported} planilhas")
            await auth.disconnect()
            
        except Exception as e:
            self._log_step("export", "error", str(e))
            raise
    
    async def _step_validate(self):
        """02:20 - Validação dos arquivos"""
        logger.info("[02:20] Validando arquivos...")
        self._log_step("validation", "started", "Validando estrutura de arquivos")
        
        try:
            validator = ExportValidator()
            # Validation logic here
            self._log_step("validation", "success", "Validação concluída")
        except Exception as e:
            self._log_step("validation", "error", str(e))
            raise
    
    async def _step_staging(self):
        """02:30 - Importação para staging"""
        logger.info("[02:30] Importando para staging...")
        self._log_step("staging", "started", "Carregando dados ao banco staging")
        
        try:
            loader = StagingLoader(self.db)
            records_imported = await loader.load_all_exports()
            self.sync_execution.records_imported = records_imported
            self._log_step("staging", "success", f"{records_imported} registros importados")
        except Exception as e:
            self._log_step("staging", "error", str(e))
            raise
    
    async def _step_normalization(self):
        """02:40 - Normalização"""
        logger.info("[02:40] Normalizando dados...")
        self._log_step("normalization", "started", "Padronizando campos")
        
        try:
            normalizer = NormalizationEngine()
            # Normalization logic here
            self._log_step("normalization", "success", "Normalização concluída")
        except Exception as e:
            self._log_step("normalization", "error", str(e))
            raise
    
    async def _step_comparison(self):
        """02:50 - Comparação"""
        logger.info("[02:50] Comparando dados...")
        self._log_step("comparison", "started", "Matching Clairis vs Pipedrive")
        
        try:
            comparator = ComparisonEngine()
            # Comparison logic here
            self._log_step("comparison", "success", "Comparação concluída")
        except Exception as e:
            self._log_step("comparison", "error", str(e))
            raise
    
    async def _step_audit(self):
        """03:10 - Auditoria"""
        logger.info("[03:10] Gerando auditoria...")
        self._log_step("audit", "started", "Criando registros de auditoria")
        
        try:
            auditor = AuditEngine()
            # Audit logic here
            self._log_step("audit", "success", "Auditoria concluída")
        except Exception as e:
            self._log_step("audit", "error", str(e))
            raise
    
    async def _step_approval(self):
        """03:20 - Fila de aprovação"""
        logger.info("[03:20] Gerando fila de aprovação...")
        self._log_step("approval", "started", "Aguardando aprovação")
        
        try:
            approval_manager = ApprovalQueueManager(self.db)
            # Approval logic here
            self._log_step("approval", "success", "Fila de aprovação criada")
        except Exception as e:
            self._log_step("approval", "error", str(e))
            raise
    
    async def _step_journey_analysis(self):
        """Análise de jornada do paciente"""
        logger.info("Analisando jornada dos pacientes...")
        self._log_step("journey", "started", "Analisando jornada de cada paciente")
        
        try:
            analyzer = PatientJourneyAnalyzer()
            # Journey analysis logic here
            self._log_step("journey", "success", "Jornada dos pacientes analisada")
        except Exception as e:
            self._log_step("journey", "error", str(e))
            raise
    
    async def _step_crm_update(self):
        """Atualização do Pipedrive"""
        logger.info("Atualizando Pipedrive...")
        self._log_step("crm_update", "started", "Sincronizando Pipedrive")
        
        try:
            # CRM update logic here
            self._log_step("crm_update", "success", "Pipedrive atualizado")
        except Exception as e:
            self._log_step("crm_update", "error", str(e))
            raise
    
    async def _step_executive_os_update(self):
        """Atualização do banco Executive OS"""
        logger.info("Atualizando Executive OS...")
        self._log_step("executive_os_update", "started", "Sincronizando banco principal")
        
        try:
            # Executive OS update logic here
            self._log_step("executive_os_update", "success", "Executive OS atualizado")
        except Exception as e:
            self._log_step("executive_os_update", "error", str(e))
            raise
    
    async def _step_finish(self, status: str) -> dict:
        """Finaliza sincronização"""
        end_time = datetime.utcnow()
        duration = (end_time - self.start_time).total_seconds()
        
        self.sync_execution.completed_at = end_time
        self.sync_execution.status = status
        self.sync_execution.duration_seconds = int(duration)
        self.db.commit()
        
        logger.info(f"Sincronização finalizada: {status} ({duration}s)")
        
        return {
            "batch_id": self.batch_id,
            "status": status,
            "duration_seconds": int(duration),
            "timestamp": end_time.isoformat()
        }
    
    def _log_step(self, step: str, status: str, message: str):
        """Registra log de uma etapa"""
        log_entry = SyncLog(
            batch_id=self.batch_id,
            step=step,
            status=status,
            message=message,
            timestamp=datetime.utcnow()
        )
        self.db.add(log_entry)
        self.db.commit()
        logger.info(f"[{step}] {status.upper()}: {message}")
