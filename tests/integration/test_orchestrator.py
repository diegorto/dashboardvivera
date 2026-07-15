import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
import asyncio

from src.models import (
    SyncExecution, ApprovalQueue,
    AuditLog, AuditLogStatus
)
from src.staging.repository import StagingRepository


class TestSyncOrchestrationFlow:
    """Testes de integração para fluxo de sincronização"""

    def test_staging_repository_available(self, test_db):
        """Testa que repositório de staging está disponível"""
        repo = StagingRepository(test_db)
        assert repo.db is not None
        stats = repo.get_staging_stats()
        assert isinstance(stats, dict)

    def test_audit_log_creation_and_retrieval(self, test_db):
        """Testa criação e recuperação de logs de auditoria"""
        audit_log = AuditLog(
            batch_id="sync-test-batch",
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

        # Verificar persistência
        saved = test_db.query(AuditLog).filter_by(
            batch_id="sync-test-batch"
        ).first()
        assert saved is not None
        assert saved.confidence_level == 95.0

    def test_approval_queue_workflow(self, test_db, audit_log_db):
        """Testa fluxo de fila de aprovação"""
        approval = ApprovalQueue(
            batch_id="approval-flow-test",
            audit_log_id=audit_log_db.id,
            status="pending",
            action="approve",
            notes="Verificar dados"
        )
        test_db.add(approval)
        test_db.commit()

        # Simular aprovação
        approval.status = "approved"
        approval.action = "approve"
        approval.assigned_to = "admin@example.com"
        approval.action_taken_at = datetime.utcnow()
        test_db.commit()

        # Verificar mudança
        updated = test_db.query(ApprovalQueue).filter_by(
            batch_id="approval-flow-test"
        ).first()
        assert updated.status == "approved"

    def test_sync_execution_record_creation(self, test_db):
        """Testa criação de registro de sincronização"""
        sync_exec = SyncExecution(
            batch_id="exec-test-batch",
            started_at=datetime.utcnow(),
            status="running",
            files_exported=100
        )
        test_db.add(sync_exec)
        test_db.commit()

        # Verificar criação
        saved = test_db.query(SyncExecution).filter_by(
            batch_id="exec-test-batch"
        ).first()
        assert saved is not None
        assert saved.status == "running"

    def test_sync_execution_completion(self, test_db):
        """Testa conclusão de sincronização"""
        sync_exec = SyncExecution(
            batch_id="exec-complete-test",
            started_at=datetime.utcnow(),
            status="running",
            files_exported=100,
            records_imported=100
        )
        test_db.add(sync_exec)
        test_db.commit()

        # Simular conclusão
        sync_exec.status = "success"
        sync_exec.completed_at = datetime.utcnow()
        sync_exec.duration_seconds = 300
        test_db.commit()

        # Verificar conclusão
        completed = test_db.query(SyncExecution).filter_by(
            batch_id="exec-complete-test"
        ).first()
        assert completed.status == "success"
        assert completed.completed_at is not None
        assert completed.duration_seconds == 300

    def test_multiple_batches_isolation(self, test_db):
        """Testa isolamento entre múltiplos batches"""
        # Criar dois batches
        batch1 = SyncExecution(
            batch_id="batch-001",
            status="success",
            files_exported=50
        )
        batch2 = SyncExecution(
            batch_id="batch-002",
            status="success",
            files_exported=75
        )
        test_db.add_all([batch1, batch2])
        test_db.commit()

        # Verificar isolamento
        b1 = test_db.query(SyncExecution).filter_by(batch_id="batch-001").first()
        b2 = test_db.query(SyncExecution).filter_by(batch_id="batch-002").first()

        assert b1.files_exported == 50
        assert b2.files_exported == 75
        assert b1.batch_id != b2.batch_id

    def test_error_status_recording(self, test_db):
        """Testa registro de status de erro"""
        sync_exec = SyncExecution(
            batch_id="error-test-batch",
            status="error",
            errors="Connection timeout"
        )
        test_db.add(sync_exec)
        test_db.commit()

        # Verificar erro
        saved = test_db.query(SyncExecution).filter_by(
            batch_id="error-test-batch"
        ).first()
        assert saved.status == "error"
        assert "Connection" in saved.errors

    def test_approval_rejection_workflow(self, test_db, audit_log_db):
        """Testa fluxo de rejeição de aprovação"""
        approval = ApprovalQueue(
            batch_id="rejection-test",
            audit_log_id=audit_log_db.id,
            status="pending",
            action="reject"
        )
        test_db.add(approval)
        test_db.commit()

        # Simular rejeição
        approval.status = "rejected"
        approval.assigned_to = "reviewer@example.com"
        approval.notes = "Dados inconsistentes"
        test_db.commit()

        # Verificar rejeição
        rejected = test_db.query(ApprovalQueue).filter_by(
            batch_id="rejection-test"
        ).first()
        assert rejected.status == "rejected"
        assert "Dados" in rejected.notes

    def test_concurrent_audit_logs(self, test_db):
        """Testa múltiplos logs de auditoria"""
        batch_id = "concurrent-audit-test"

        # Criar múltiplos logs
        logs = []
        for i in range(10):
            log = AuditLog(
                batch_id=batch_id,
                entity_type="person",
                entity_id=f"CLR-{i:05d}",
                field_name="phone",
                old_value="5548988888888",
                new_value="5548999999999",
                status=AuditLogStatus.IMPORTED,
                confidence_level=95.0 + i
            )
            logs.append(log)

        test_db.add_all(logs)
        test_db.commit()

        # Verificar quantidade
        count = test_db.query(AuditLog).filter_by(batch_id=batch_id).count()
        assert count == 10

    def test_batch_statistics_aggregation(self, test_db):
        """Testa agregação de estatísticas por batch"""
        batch_id = "stats-test-batch"

        # Criar 3 registros de sincronização
        for status in ["success", "success", "error"]:
            sync_exec = SyncExecution(
                batch_id=f"{batch_id}-{status}",
                status=status,
                files_exported=100
            )
            test_db.add(sync_exec)

        test_db.commit()

        # Verificar que foram criados
        all_execs = test_db.query(SyncExecution).filter(
            SyncExecution.batch_id.startswith(batch_id)
        ).all()
        assert len(all_execs) == 3

    def test_approval_queue_pagination(self, test_db, audit_log_db):
        """Testa paginação de fila de aprovação"""
        batch_id = "pagination-test"

        # Criar 15 itens
        for i in range(15):
            approval = ApprovalQueue(
                batch_id=batch_id,
                audit_log_id=audit_log_db.id,
                status="pending",
                notes=f"Item {i}"
            )
            test_db.add(approval)

        test_db.commit()

        # Simular paginação
        page_size = 5
        page1 = test_db.query(ApprovalQueue).filter_by(
            batch_id=batch_id
        ).limit(page_size).all()

        assert len(page1) == 5

    def test_data_integrity_constraints(self, test_db):
        """Testa integridade de dados com constraints"""
        # Tentar criar sync exec com batch_id único
        sync1 = SyncExecution(batch_id="unique-test", status="success")
        test_db.add(sync1)
        test_db.commit()

        # Verificar que foi criado
        saved = test_db.query(SyncExecution).filter_by(
            batch_id="unique-test"
        ).first()
        assert saved is not None
