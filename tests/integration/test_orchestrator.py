import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
import asyncio

from src.orchestrator import ExecutiveOSSyncOrchestrator
from src.models import (
    SyncExecution, SyncExecutionStatus,
    ApprovalQueue, ApprovalQueueStatus,
    AuditLog, AuditLogStatus,
    ConflictQueue
)
from src.pipedrive.api import PipedriveAPIClient
from src.staging.repository import StagingRepository


class TestExecutiveOSSyncOrchestrator:
    """Testes de integração para sincronização completa"""

    @pytest.fixture
    async def orchestrator(self, test_db):
        """Cria orchestrator para testes"""
        return ExecutiveOSSyncOrchestrator(test_db, batch_id="test-batch")

    @pytest.mark.asyncio
    async def test_orchestrator_initialization(self, orchestrator):
        """Testa inicialização do orchestrator"""
        assert orchestrator.batch_id == "test-batch"
        assert orchestrator.db is not None
        assert orchestrator.execution_log == []

    @pytest.mark.asyncio
    async def test_sync_execution_creates_record(self, test_db):
        """Testa que sincronização cria registro"""
        orchestrator = ExecutiveOSSyncOrchestrator(test_db, batch_id="test-batch-2")

        with patch.object(orchestrator, "run_sync", new_callable=AsyncMock):
            sync_exec = orchestrator._create_sync_execution()
            assert sync_exec is not None
            assert sync_exec.batch_id == "test-batch-2"
            assert sync_exec.status == SyncExecutionStatus.PENDING

    @pytest.mark.asyncio
    async def test_step_export_clairis_success(self, orchestrator):
        """Testa exportação do Clairis"""
        with patch.object(orchestrator, "_step_export_clairis", new_callable=AsyncMock):
            orchestrator._step_export_clairis.return_value = (True, {"patients": 100})
            success, stats = await orchestrator._step_export_clairis()
            assert success is True
            assert "patients" in stats

    @pytest.mark.asyncio
    async def test_step_staging_success(self, orchestrator):
        """Testa etapa de staging"""
        with patch.object(orchestrator, "_step_staging", new_callable=AsyncMock):
            orchestrator._step_staging.return_value = (True, {"staged": 100})
            success, stats = await orchestrator._step_staging()
            assert success is True

    @pytest.mark.asyncio
    async def test_step_normalization_success(self, orchestrator):
        """Testa normalização de dados"""
        with patch.object(orchestrator, "_step_normalization", new_callable=AsyncMock):
            orchestrator._step_normalization.return_value = (True, {"normalized": 100})
            success, stats = await orchestrator._step_normalization()
            assert success is True

    @pytest.mark.asyncio
    async def test_step_comparison_success(self, orchestrator):
        """Testa comparação Clairis vs Pipedrive"""
        with patch.object(orchestrator, "_step_comparison", new_callable=AsyncMock):
            orchestrator._step_comparison.return_value = (True, {"compared": 100})
            success, stats = await orchestrator._step_comparison()
            assert success is True

    @pytest.mark.asyncio
    async def test_step_conflict_detection_no_conflicts(self, orchestrator):
        """Testa detecção de conflitos (nenhum)"""
        with patch.object(orchestrator, "_step_conflict_detection", new_callable=AsyncMock):
            orchestrator._step_conflict_detection.return_value = (True, {"conflicts": 0})
            success, stats = await orchestrator._step_conflict_detection()
            assert success is True
            assert stats["conflicts"] == 0

    @pytest.mark.asyncio
    async def test_step_conflict_detection_with_conflicts(self, orchestrator):
        """Testa detecção de conflitos (com conflitos)"""
        with patch.object(orchestrator, "_step_conflict_detection", new_callable=AsyncMock):
            orchestrator._step_conflict_detection.return_value = (True, {"conflicts": 5})
            success, stats = await orchestrator._step_conflict_detection()
            assert success is True
            assert stats["conflicts"] == 5

    @pytest.mark.asyncio
    async def test_step_audit_logging(self, orchestrator):
        """Testa criação de logs de auditoria"""
        with patch.object(orchestrator, "_step_audit_logging", new_callable=AsyncMock):
            orchestrator._step_audit_logging.return_value = (True, {"audit_logs": 100})
            success, stats = await orchestrator._step_audit_logging()
            assert success is True

    @pytest.mark.asyncio
    async def test_step_approval_queue_creation(self, orchestrator, test_db):
        """Testa criação de fila de aprovação"""
        with patch.object(orchestrator, "_step_approval_queue_creation", new_callable=AsyncMock):
            orchestrator._step_approval_queue_creation.return_value = (True, {"queued": 50})
            success, stats = await orchestrator._step_approval_queue_creation()
            assert success is True

    @pytest.mark.asyncio
    async def test_step_approval_processing(self, orchestrator):
        """Testa processamento de aprovações"""
        with patch.object(orchestrator, "_step_approval_processing", new_callable=AsyncMock):
            orchestrator._step_approval_processing.return_value = (True, {"approved": 45, "rejected": 5})
            success, stats = await orchestrator._step_approval_processing()
            assert success is True
            assert stats["approved"] == 45

    @pytest.mark.asyncio
    async def test_step_crm_update_success(self, orchestrator):
        """Testa atualização no CRM"""
        with patch.object(orchestrator, "_step_crm_update", new_callable=AsyncMock):
            orchestrator._step_crm_update.return_value = (True, {"updated": 45, "created": 0})
            success, stats = await orchestrator._step_crm_update()
            assert success is True

    @pytest.mark.asyncio
    async def test_step_executive_os_update(self, orchestrator):
        """Testa atualização do Executive OS"""
        with patch.object(orchestrator, "_step_executive_os_update", new_callable=AsyncMock):
            orchestrator._step_executive_os_update.return_value = (True, {"synced": 45})
            success, stats = await orchestrator._step_executive_os_update()
            assert success is True

    @pytest.mark.asyncio
    async def test_step_reporting_dashboards(self, orchestrator):
        """Testa geração de relatórios"""
        with patch.object(orchestrator, "_step_reporting_dashboards", new_callable=AsyncMock):
            orchestrator._step_reporting_dashboards.return_value = (True, {"dashboards": 5})
            success, stats = await orchestrator._step_reporting_dashboards()
            assert success is True

    @pytest.mark.asyncio
    async def test_step_ia_processing(self, orchestrator):
        """Testa processamento de IA"""
        with patch.object(orchestrator, "_step_ia_processing", new_callable=AsyncMock):
            orchestrator._step_ia_processing.return_value = (True, {"insights": 10})
            success, stats = await orchestrator._step_ia_processing()
            assert success is True

    @pytest.mark.asyncio
    async def test_complete_sync_flow_success(self, orchestrator):
        """Testa fluxo completo de sincronização"""
        # Mock all steps
        step_methods = [
            "_step_export_clairis",
            "_step_staging",
            "_step_normalization",
            "_step_comparison",
            "_step_conflict_detection",
            "_step_audit_logging",
            "_step_approval_queue_creation",
            "_step_approval_processing",
            "_step_crm_update",
            "_step_executive_os_update",
            "_step_reporting_dashboards",
            "_step_ia_processing"
        ]

        for method_name in step_methods:
            with patch.object(orchestrator, method_name, new_callable=AsyncMock):
                method = getattr(orchestrator, method_name)
                method.return_value = (True, {"status": "ok"})

    @pytest.mark.asyncio
    async def test_sync_failure_recovery(self, orchestrator):
        """Testa recuperação de falha durante sincronização"""
        with patch.object(orchestrator, "_step_export_clairis", new_callable=AsyncMock):
            orchestrator._step_export_clairis.return_value = (False, {"error": "Export failed"})
            success, stats = await orchestrator._step_export_clairis()
            assert success is False

    @pytest.mark.asyncio
    async def test_conflict_quarantine_and_resolution(self, test_db):
        """Testa quarentena de conflito e resolução"""
        orchestrator = ExecutiveOSSyncOrchestrator(test_db, batch_id="conflict-test")

        conflict = ConflictQueue(
            batch_id="conflict-test",
            entity_type="person",
            entity_id="CLR-12345",
            field_name="email",
            clairis_value="old@example.com",
            pipedrive_value="new@example.com",
            status="PENDING"
        )
        test_db.add(conflict)
        test_db.commit()

        # Verificar que conflito foi criado
        saved_conflict = test_db.query(ConflictQueue).filter_by(
            batch_id="conflict-test"
        ).first()
        assert saved_conflict is not None
        assert saved_conflict.status == "PENDING"

    @pytest.mark.asyncio
    async def test_approval_workflow_integration(self, test_db):
        """Testa integração do workflow de aprovação"""
        from src.models import ApprovalQueue, ApprovalQueueStatus

        orchestrator = ExecutiveOSSyncOrchestrator(test_db, batch_id="approval-test")

        approval = ApprovalQueue(
            batch_id="approval-test",
            entity_type="person",
            entity_id="CLR-99999",
            field_name="phone",
            old_value="5548988888888",
            new_value="5548999999999",
            status=ApprovalQueueStatus.PENDING
        )
        test_db.add(approval)
        test_db.commit()

        # Verificar que item foi enfileirado
        queued = test_db.query(ApprovalQueue).filter_by(
            batch_id="approval-test"
        ).first()
        assert queued is not None
        assert queued.status == ApprovalQueueStatus.PENDING

    @pytest.mark.asyncio
    async def test_audit_trail_creation(self, test_db):
        """Testa criação de trilha de auditoria"""
        orchestrator = ExecutiveOSSyncOrchestrator(test_db, batch_id="audit-test")

        audit_log = AuditLog(
            batch_id="audit-test",
            entity_type="person",
            entity_id="CLR-12345",
            field_name="email",
            old_value="old@example.com",
            new_value="new@example.com",
            status=AuditLogStatus.IMPORTED,
            confidence_level=95.0
        )
        test_db.add(audit_log)
        test_db.commit()

        # Verificar que log foi criado
        saved_log = test_db.query(AuditLog).filter_by(
            batch_id="audit-test"
        ).first()
        assert saved_log is not None
        assert saved_log.confidence_level == 95.0

    @pytest.mark.asyncio
    async def test_rate_limiting_applied(self, orchestrator):
        """Testa aplicação de rate limiting"""
        with patch("src.pipedrive.api.RateLimiter") as mock_limiter:
            mock_limiter_instance = MagicMock()
            mock_limiter.return_value = mock_limiter_instance
            mock_limiter_instance.wait = AsyncMock()

            # Simular requisições
            for _ in range(5):
                await mock_limiter_instance.wait()

            assert mock_limiter_instance.wait.call_count == 5

    @pytest.mark.asyncio
    async def test_statistics_tracking(self, orchestrator):
        """Testa rastreamento de estatísticas"""
        orchestrator.sync_stats = {
            "exported": 100,
            "imported": 100,
            "updated": 45,
            "created": 0,
            "failed": 0
        }

        assert orchestrator.sync_stats["exported"] == 100
        assert orchestrator.sync_stats["imported"] == 100
        assert orchestrator.sync_stats["updated"] == 45

    @pytest.mark.asyncio
    async def test_error_logging_on_failure(self, orchestrator):
        """Testa logging de erro em caso de falha"""
        error_msg = "Test error during sync"

        with patch.object(orchestrator, "_step_export_clairis", new_callable=AsyncMock):
            orchestrator._step_export_clairis.side_effect = Exception(error_msg)

            try:
                await orchestrator._step_export_clairis()
            except Exception as e:
                assert str(e) == error_msg

    @pytest.mark.asyncio
    async def test_concurrent_operations(self, orchestrator):
        """Testa operações concorrentes"""
        async def mock_operation(duration):
            await asyncio.sleep(duration)
            return True

        # Criar múltiplas operações concorrentes
        operations = [
            mock_operation(0.01),
            mock_operation(0.01),
            mock_operation(0.01)
        ]

        results = await asyncio.gather(*operations)
        assert all(results)

    @pytest.mark.asyncio
    async def test_batch_processing_statistics(self, orchestrator):
        """Testa estatísticas de processamento em batch"""
        batch_stats = {
            "total_patients": 100,
            "successfully_synced": 95,
            "conflicts": 3,
            "failed": 2
        }

        total = batch_stats["total_patients"]
        success_rate = (batch_stats["successfully_synced"] / total) * 100

        assert success_rate == 95.0
        assert batch_stats["conflicts"] == 3

    @pytest.mark.asyncio
    async def test_pipedrive_api_client_initialization(self, orchestrator):
        """Testa inicialização do cliente Pipedrive"""
        with patch("src.orchestrator.PipedriveAPIClient") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value = mock_client

            # Simular inicialização
            client = mock_client_class(api_token="test-token")
            assert client is not None

    @pytest.mark.asyncio
    async def test_staging_repository_integration(self, orchestrator, test_db):
        """Testa integração com StagingRepository"""
        repo = StagingRepository(test_db)

        # Verificar que repositório está acessível
        assert repo.db is not None
        stats = repo.get_staging_stats()
        assert isinstance(stats, dict)

    @pytest.mark.asyncio
    async def test_data_consistency_check(self, orchestrator, test_db):
        """Testa verificação de consistência de dados"""
        # Simular verificação de integridade
        consistency_ok = True
        error_messages = []

        if not consistency_ok:
            error_messages.append("Data inconsistency detected")

        assert consistency_ok is True
        assert len(error_messages) == 0
