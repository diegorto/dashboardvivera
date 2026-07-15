import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from src.models import ApprovalQueue, AuditLog, AuditLogStatus


class TestApprovalQueueModels:
    """Testes para modelos de fila de aprovação"""

    def test_approval_queue_creation(self, test_db):
        """Testa criação de item de aprovação"""
        approval = ApprovalQueue(
            batch_id="test-batch",
            status="pending",
            action="approve",
            notes="Verificar dados"
        )
        test_db.add(approval)
        test_db.commit()

        saved = test_db.query(ApprovalQueue).filter_by(
            batch_id="test-batch"
        ).first()
        assert saved is not None
        assert saved.status == "pending"

    def test_approval_queue_approve_action(self, test_db):
        """Testa aprovação de item"""
        approval = ApprovalQueue(
            batch_id="approve-test",
            status="pending",
            action="approve"
        )
        test_db.add(approval)
        test_db.commit()

        # Simular aprovação
        approval.status = "approved"
        approval.assigned_to = "admin@example.com"
        approval.action_taken_at = datetime.utcnow()
        test_db.commit()

        updated = test_db.query(ApprovalQueue).filter_by(
            batch_id="approve-test"
        ).first()
        assert updated.status == "approved"
        assert updated.assigned_to is not None

    def test_approval_queue_reject_action(self, test_db):
        """Testa rejeição de item"""
        approval = ApprovalQueue(
            batch_id="reject-test",
            status="pending",
            action="reject"
        )
        test_db.add(approval)
        test_db.commit()

        # Simular rejeição
        approval.status = "rejected"
        approval.notes = "Dados inválidos"
        approval.action_taken_at = datetime.utcnow()
        test_db.commit()

        updated = test_db.query(ApprovalQueue).filter_by(
            batch_id="reject-test"
        ).first()
        assert updated.status == "rejected"
        assert "inválidos" in updated.notes

    def test_approval_queue_correct_action(self, test_db):
        """Testa correção de item"""
        approval = ApprovalQueue(
            batch_id="correct-test",
            status="pending",
            action="correct"
        )
        test_db.add(approval)
        test_db.commit()

        # Simular correção
        approval.status = "corrected"
        approval.notes = "joao.silva@example.com"
        test_db.commit()

        updated = test_db.query(ApprovalQueue).filter_by(
            batch_id="correct-test"
        ).first()
        assert updated.status == "corrected"

    def test_approval_queue_with_audit_log(self, test_db, audit_log_db):
        """Testa vinculação com audit log"""
        approval = ApprovalQueue(
            batch_id="linked-test",
            audit_log_id=audit_log_db.id,
            status="pending"
        )
        test_db.add(approval)
        test_db.commit()

        saved = test_db.query(ApprovalQueue).filter_by(
            batch_id="linked-test"
        ).first()
        assert saved.audit_log_id == audit_log_db.id

    def test_approval_queue_list_pending(self, test_db, audit_log_db):
        """Testa listagem de itens pendentes"""
        # Criar múltiplos itens
        for i in range(5):
            approval = ApprovalQueue(
                batch_id="list-test",
                audit_log_id=audit_log_db.id,
                status="pending",
                notes=f"Item {i}"
            )
            test_db.add(approval)

        test_db.commit()

        # Listar pendentes
        pending = test_db.query(ApprovalQueue).filter(
            ApprovalQueue.status == "pending"
        ).all()
        assert len(pending) >= 5

    def test_approval_queue_list_by_batch(self, test_db, audit_log_db):
        """Testa listagem por batch"""
        batch_id = "batch-list-test"

        # Criar itens em um batch
        for i in range(3):
            approval = ApprovalQueue(
                batch_id=batch_id,
                audit_log_id=audit_log_db.id,
                status="pending"
            )
            test_db.add(approval)

        test_db.commit()

        # Listar por batch
        items = test_db.query(ApprovalQueue).filter_by(
            batch_id=batch_id
        ).all()
        assert len(items) == 3

    def test_approval_queue_pagination(self, test_db, audit_log_db):
        """Testa paginação de resultados"""
        batch_id = "pagination-test"

        # Criar 20 itens
        for i in range(20):
            approval = ApprovalQueue(
                batch_id=batch_id,
                audit_log_id=audit_log_db.id,
                status="pending"
            )
            test_db.add(approval)

        test_db.commit()

        # Simular paginação
        limit = 10
        offset = 0
        page1 = test_db.query(ApprovalQueue).filter_by(
            batch_id=batch_id
        ).limit(limit).offset(offset).all()

        assert len(page1) == 10

    def test_approval_queue_status_counts(self, test_db, audit_log_db):
        """Testa contagem de itens por status"""
        batch_id = "status-count-test"

        # Criar itens com diferentes status
        statuses = ["pending", "pending", "approved", "rejected"]
        for status in statuses:
            approval = ApprovalQueue(
                batch_id=batch_id,
                audit_log_id=audit_log_db.id,
                status=status
            )
            test_db.add(approval)

        test_db.commit()

        # Contar por status
        pending_count = test_db.query(ApprovalQueue).filter(
            ApprovalQueue.batch_id == batch_id,
            ApprovalQueue.status == "pending"
        ).count()
        approved_count = test_db.query(ApprovalQueue).filter(
            ApprovalQueue.batch_id == batch_id,
            ApprovalQueue.status == "approved"
        ).count()

        assert pending_count == 2
        assert approved_count == 1

    def test_approval_queue_timestamp_tracking(self, test_db, audit_log_db):
        """Testa rastreamento de timestamps"""
        before = datetime.utcnow()

        approval = ApprovalQueue(
            batch_id="timestamp-test",
            audit_log_id=audit_log_db.id,
            status="pending"
        )
        test_db.add(approval)
        test_db.commit()

        after = datetime.utcnow()

        saved = test_db.query(ApprovalQueue).filter_by(
            batch_id="timestamp-test"
        ).first()

        # Verificar que created_at foi definido
        assert saved.created_at is not None
        assert before <= saved.created_at <= after

    def test_approval_queue_assigned_user_tracking(self, test_db, audit_log_db):
        """Testa rastreamento de usuário responsável"""
        approval = ApprovalQueue(
            batch_id="assignment-test",
            audit_log_id=audit_log_db.id,
            status="pending"
        )
        test_db.add(approval)
        test_db.commit()

        # Atribuir a um usuário
        approval.assigned_to = "reviewer@example.com"
        test_db.commit()

        updated = test_db.query(ApprovalQueue).filter_by(
            batch_id="assignment-test"
        ).first()
        assert updated.assigned_to == "reviewer@example.com"

    def test_approval_queue_bulk_update(self, test_db, audit_log_db):
        """Testa atualização em massa"""
        batch_id = "bulk-test"

        # Criar itens
        items_to_create = []
        for i in range(5):
            approval = ApprovalQueue(
                batch_id=batch_id,
                audit_log_id=audit_log_db.id,
                status="pending"
            )
            items_to_create.append(approval)

        test_db.add_all(items_to_create)
        test_db.commit()

        # Atualizar todos
        test_db.query(ApprovalQueue).filter_by(
            batch_id=batch_id
        ).update({"status": "approved"})
        test_db.commit()

        # Verificar
        count = test_db.query(ApprovalQueue).filter(
            ApprovalQueue.batch_id == batch_id,
            ApprovalQueue.status == "approved"
        ).count()
        assert count == 5

    def test_approval_queue_with_notes(self, test_db, audit_log_db):
        """Testa armazenamento de notas"""
        note = "Verificar dados pessoais - telefone divergente"
        approval = ApprovalQueue(
            batch_id="notes-test",
            audit_log_id=audit_log_db.id,
            status="pending",
            notes=note
        )
        test_db.add(approval)
        test_db.commit()

        saved = test_db.query(ApprovalQueue).filter_by(
            batch_id="notes-test"
        ).first()
        assert saved.notes == note

    def test_approval_queue_batch_summary(self, test_db, audit_log_db):
        """Testa resumo estatístico de batch"""
        batch_id = "summary-test"

        # Criar mistura de status
        status_distribution = {
            "pending": 5,
            "approved": 3,
            "rejected": 2
        }

        for status, count in status_distribution.items():
            for i in range(count):
                approval = ApprovalQueue(
                    batch_id=batch_id,
                    audit_log_id=audit_log_db.id,
                    status=status
                )
                test_db.add(approval)

        test_db.commit()

        # Verificar estatísticas
        total = test_db.query(ApprovalQueue).filter_by(
            batch_id=batch_id
        ).count()
        approved = test_db.query(ApprovalQueue).filter(
            ApprovalQueue.batch_id == batch_id,
            ApprovalQueue.status == "approved"
        ).count()

        assert total == 10
        assert approved == 3
