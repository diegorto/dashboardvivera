import pytest
from datetime import datetime
from src.conflicts.manager import ConflictQueueManager
from src.executive_os.database import ConflictQueue


class TestConflictQueueManager:
    """Testes para ConflictQueueManager"""

    def test_init(self, test_db):
        """Testa inicialização do manager"""
        manager = ConflictQueueManager(test_db)
        assert manager.db is not None
        assert hasattr(manager, "reconciliation")

    def test_get_pending_conflicts_empty(self, test_db):
        """Testa retorno vazio quando não há conflitos"""
        manager = ConflictQueueManager(test_db)
        result = manager.get_pending_conflicts()
        assert result == []

    def test_get_pending_conflicts_with_data(self, test_db, conflict_db):
        """Testa busca de conflitos pendentes"""
        manager = ConflictQueueManager(test_db)
        result = manager.get_pending_conflicts()

        assert len(result) == 1
        assert result[0]["status"] == "PENDING"
        assert result[0]["clairis_id"] == "CLR-12345"

    def test_get_conflict_by_id(self, test_db, conflict_db):
        """Testa busca de conflito específico"""
        manager = ConflictQueueManager(test_db)
        result = manager.get_conflict_by_id(conflict_db.id)

        assert result is not None
        assert result["id"] == conflict_db.id
        assert result["conflict_field"] == "phone"

    def test_get_conflict_by_id_not_found(self, test_db):
        """Testa busca de conflito inexistente"""
        manager = ConflictQueueManager(test_db)
        result = manager.get_conflict_by_id(9999)

        assert result is None

    def test_get_conflicts_by_entity(self, test_db, conflict_db):
        """Testa busca de conflitos por entidade"""
        manager = ConflictQueueManager(test_db)
        result = manager.get_conflicts_by_entity("person", "CLR-12345")

        assert len(result) == 1
        assert result[0]["entity_id"] == "CLR-12345"

    def test_get_conflicts_by_field(self, test_db, conflict_db):
        """Testa busca de conflitos por campo"""
        manager = ConflictQueueManager(test_db)
        result = manager.get_conflicts_by_field("phone")

        assert len(result) == 1
        assert result[0]["conflict_field"] == "phone"

    def test_get_conflicts_by_batch(self, test_db, conflict_db):
        """Testa busca de conflitos por batch"""
        manager = ConflictQueueManager(test_db)
        result = manager.get_conflicts_by_batch("batch-123")

        assert len(result) == 1
        assert result[0]["batch_id"] == "batch-123"

    def test_resolve_conflict_not_found(self, test_db):
        """Testa resolução de conflito inexistente"""
        manager = ConflictQueueManager(test_db)
        success, msg = manager.resolve_conflict(9999, "CLAIRIS_WINS", "value", "user")

        assert success is False
        assert "não encontrado" in msg.lower()

    def test_resolve_conflict_invalid_strategy(self, test_db, conflict_db):
        """Testa resolução com estratégia inválida"""
        manager = ConflictQueueManager(test_db)
        success, msg = manager.resolve_conflict(conflict_db.id, "INVALID", "value", "user")

        assert success is False
        assert "inválida" in msg.lower()

    def test_resolve_conflict_clairis_wins(self, test_db, conflict_db):
        """Testa resolução com CLAIRIS_WINS"""
        manager = ConflictQueueManager(test_db)
        success, msg = manager.resolve_conflict(conflict_db.id, "CLAIRIS_WINS", None, "user@example.com")

        assert success is True
        assert "resolvido" in msg.lower()

        # Verificar que foi atualizado
        updated = test_db.query(ConflictQueue).filter(ConflictQueue.id == conflict_db.id).first()
        assert updated.status == "RESOLVED"
        assert updated.resolution == "CLAIRIS_WINS"
        assert updated.resolved_value == conflict_db.clairis_value

    def test_resolve_conflict_pipedrive_wins(self, test_db, conflict_db):
        """Testa resolução com PIPEDRIVE_WINS"""
        manager = ConflictQueueManager(test_db)
        success, msg = manager.resolve_conflict(conflict_db.id, "PIPEDRIVE_WINS", None, "user@example.com")

        assert success is True

        updated = test_db.query(ConflictQueue).filter(ConflictQueue.id == conflict_db.id).first()
        assert updated.status == "RESOLVED"
        assert updated.resolution == "PIPEDRIVE_WINS"
        assert updated.resolved_value == conflict_db.pipedrive_value

    def test_resolve_conflict_manual(self, test_db, conflict_db):
        """Testa resolução com valor customizado"""
        manager = ConflictQueueManager(test_db)
        custom_value = "5548977777777"
        success, msg = manager.resolve_conflict(conflict_db.id, "MANUAL", custom_value, "user@example.com")

        assert success is True

        updated = test_db.query(ConflictQueue).filter(ConflictQueue.id == conflict_db.id).first()
        assert updated.status == "RESOLVED"
        assert updated.resolution == "MANUAL"
        assert updated.resolved_value == custom_value

    def test_ignore_conflict(self, test_db, conflict_db):
        """Testa ignorar conflito"""
        manager = ConflictQueueManager(test_db)
        success, msg = manager.ignore_conflict(conflict_db.id, "user@example.com")

        assert success is True

        updated = test_db.query(ConflictQueue).filter(ConflictQueue.id == conflict_db.id).first()
        assert updated.status == "IGNORED"
        assert updated.resolved_by == "user@example.com"

    def test_reopen_conflict(self, test_db, conflict_db):
        """Testa reabertura de conflito"""
        manager = ConflictQueueManager(test_db)

        # Primeiro resolver
        manager.resolve_conflict(conflict_db.id, "CLAIRIS_WINS", None, "user")

        # Depois reabrir
        success, msg = manager.reopen_conflict(conflict_db.id)

        assert success is True

        updated = test_db.query(ConflictQueue).filter(ConflictQueue.id == conflict_db.id).first()
        assert updated.status == "PENDING"
        assert updated.resolution is None
        assert updated.resolved_by is None

    def test_reopen_conflict_already_pending(self, test_db, conflict_db):
        """Testa reabertura de conflito já pendente"""
        manager = ConflictQueueManager(test_db)
        success, msg = manager.reopen_conflict(conflict_db.id)

        assert success is False
        assert "pendente" in msg.lower()

    def test_resolve_bulk_conflicts(self, test_db, sample_patient):
        """Testa resolução em lote"""
        manager = ConflictQueueManager(test_db)

        # Criar múltiplos conflitos
        conflicts = []
        for i in range(3):
            conflict = ConflictQueue(
                batch_id="batch-123",
                entity_type="person",
                entity_id=f"CLR-{i}",
                clairis_id=f"CLR-{i}",
                pipedrive_id=i,
                conflict_field="phone",
                clairis_value="5548999999999",
                pipedrive_value="5548988888888",
                status="PENDING",
                created_at=datetime.utcnow()
            )
            test_db.add(conflict)
            conflicts.append(conflict)

        test_db.commit()

        conflict_ids = [c.id for c in conflicts]
        result = manager.resolve_bulk_conflicts(conflict_ids, "CLAIRIS_WINS", "user")

        assert result["total"] == 3
        assert result["resolved"] == 3
        assert result["failed"] == 0

    def test_get_conflict_statistics(self, test_db, conflict_db):
        """Testa estatísticas de conflitos"""
        manager = ConflictQueueManager(test_db)
        stats = manager.get_conflict_statistics()

        assert stats["total_conflicts"] == 1
        assert stats["pending"] == 1
        assert stats["resolved"] == 0
        assert "by_entity_type" in stats

    def test_get_conflict_report(self, test_db, conflict_db):
        """Testa relatório de conflitos"""
        manager = ConflictQueueManager(test_db)
        report = manager.get_conflict_report("batch-123")

        assert report["batch_id"] == "batch-123"
        assert report["total_conflicts"] == 1
        assert report["pending_count"] == 1

    def test_get_conflict_report_empty_batch(self, test_db):
        """Testa relatório de batch vazio"""
        manager = ConflictQueueManager(test_db)
        report = manager.get_conflict_report("batch-empty")

        assert report["total_conflicts"] == 0
        assert report["pending_count"] == 0

    def test_conflict_to_dict(self, test_db, conflict_db):
        """Testa conversão de ConflictQueue para dicionário"""
        manager = ConflictQueueManager(test_db)
        result = manager._conflict_to_dict(conflict_db)

        assert result["id"] == conflict_db.id
        assert result["batch_id"] == "batch-123"
        assert result["entity_type"] == "person"
        assert "created_at" in result
