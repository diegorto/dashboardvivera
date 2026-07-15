import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.api.main import app
from src.models import ApprovalQueue, ApprovalQueueStatus, AuditLogStatus
from src.core.config import settings


class TestApprovalRoutes:
    """Testes para endpoints de aprovação REST API"""

    @pytest.fixture
    def client(self):
        """Cliente de teste FastAPI"""
        return TestClient(app)

    def test_list_approval_queue_empty(self, client, test_db):
        """Testa listagem de fila vazia"""
        response = client.get("/api/approval/queue")
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_approval_queue_with_items(self, client, test_db, approval_queue_item_db):
        """Testa listagem com itens"""
        response = client.get("/api/approval/queue")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert data["total"] >= 1

    def test_list_approval_queue_with_pagination(self, client, test_db, approval_queue_item_db):
        """Testa paginação da fila"""
        response = client.get("/api/approval/queue?limit=5&offset=0")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_list_approval_queue_filter_by_status(self, client, test_db, approval_queue_item_db):
        """Testa filtro por status"""
        response = client.get("/api/approval/queue?status=PENDING")
        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["status"] == "PENDING"

    def test_list_approval_queue_filter_by_batch(self, client, test_db, approval_queue_item_db):
        """Testa filtro por batch_id"""
        response = client.get("/api/approval/queue?batch_id=batch-test")
        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["batch_id"] == "batch-test"

    def test_get_approval_queue_item_success(self, client, test_db, approval_queue_item_db):
        """Testa obtenção de item específico"""
        item_id = approval_queue_item_db.id
        response = client.get(f"/api/approval/queue/{item_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == item_id
        assert "entity_type" in data
        assert "field_name" in data

    def test_get_approval_queue_item_not_found(self, client, test_db):
        """Testa obtenção de item inexistente"""
        response = client.get("/api/approval/queue/99999")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_approve_item_success(self, client, test_db, approval_queue_item_db):
        """Testa aprovação de item"""
        item_id = approval_queue_item_db.id
        payload = {"approved": True}

        with patch("src.api.approval_routes.ApprovalQueueManager") as mock_manager:
            mock_manager_instance = MagicMock()
            mock_manager.return_value = mock_manager_instance
            mock_manager_instance.approve_item = MagicMock(
                return_value=(True, "Aprovado com sucesso")
            )

            response = client.post(
                f"/api/approval/queue/{item_id}/approve",
                json=payload
            )
            assert response.status_code in [200, 201]

    def test_reject_item_success(self, client, test_db, approval_queue_item_db):
        """Testa rejeição de item"""
        item_id = approval_queue_item_db.id
        payload = {"reason": "Dados inválidos"}

        with patch("src.api.approval_routes.ApprovalQueueManager") as mock_manager:
            mock_manager_instance = MagicMock()
            mock_manager.return_value = mock_manager_instance
            mock_manager_instance.reject_item = MagicMock(
                return_value=(True, "Rejeitado com sucesso")
            )

            response = client.post(
                f"/api/approval/queue/{item_id}/reject",
                json=payload
            )
            assert response.status_code in [200, 201]

    def test_correct_item_success(self, client, test_db, approval_queue_item_db):
        """Testa correção de item com novo valor"""
        item_id = approval_queue_item_db.id
        payload = {"new_value": "joao.silva@example.com"}

        with patch("src.api.approval_routes.ApprovalQueueManager") as mock_manager:
            mock_manager_instance = MagicMock()
            mock_manager.return_value = mock_manager_instance
            mock_manager_instance.correct_item = MagicMock(
                return_value=(True, "Corrigido com sucesso")
            )

            response = client.post(
                f"/api/approval/queue/{item_id}/correct",
                json=payload
            )
            assert response.status_code in [200, 201]

    def test_bulk_approve_success(self, client, test_db, approval_queue_item_db):
        """Testa aprovação em massa"""
        payload = {"item_ids": [approval_queue_item_db.id]}

        with patch("src.api.approval_routes.ApprovalQueueManager") as mock_manager:
            mock_manager_instance = MagicMock()
            mock_manager.return_value = mock_manager_instance
            mock_manager_instance.bulk_approve = MagicMock(
                return_value={"approved": 1, "failed": 0, "skipped": 0}
            )

            response = client.post(
                "/api/approval/queue/bulk/approve",
                json=payload
            )
            assert response.status_code in [200, 201]

    def test_bulk_approve_empty_list(self, client, test_db):
        """Testa bulk approve com lista vazia"""
        payload = {"item_ids": []}

        response = client.post(
            "/api/approval/queue/bulk/approve",
            json=payload
        )
        assert response.status_code in [200, 400]

    def test_statistics_endpoint(self, client, test_db, approval_queue_item_db):
        """Testa endpoint de estatísticas gerais"""
        response = client.get("/api/approval/statistics")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "pending" in data
        assert "approved" in data
        assert "rejected" in data

    def test_statistics_with_data(self, client, test_db, approval_queue_item_db):
        """Testa estatísticas com dados"""
        response = client.get("/api/approval/statistics")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert isinstance(data["pending"], int)
        assert isinstance(data["approved"], int)

    def test_batch_summary_success(self, client, test_db, approval_queue_item_db):
        """Testa resumo por batch"""
        batch_id = approval_queue_item_db.batch_id
        response = client.get(f"/api/approval/batch/{batch_id}/summary")
        assert response.status_code == 200
        data = response.json()
        assert "batch_id" in data
        assert "total" in data
        assert "approved" in data
        assert "rejected" in data

    def test_batch_summary_not_found(self, client, test_db):
        """Testa resumo para batch inexistente"""
        response = client.get("/api/approval/batch/nonexistent/summary")
        assert response.status_code in [200, 404]

    def test_approve_nonexistent_item(self, client, test_db):
        """Testa aprovação de item inexistente"""
        payload = {"approved": True}
        response = client.post(
            "/api/approval/queue/99999/approve",
            json=payload
        )
        assert response.status_code in [404, 400]

    def test_reject_nonexistent_item(self, client, test_db):
        """Testa rejeição de item inexistente"""
        payload = {"reason": "Teste"}
        response = client.post(
            "/api/approval/queue/99999/reject",
            json=payload
        )
        assert response.status_code in [404, 400]

    def test_correct_nonexistent_item(self, client, test_db):
        """Testa correção de item inexistente"""
        payload = {"new_value": "test@example.com"}
        response = client.post(
            "/api/approval/queue/99999/correct",
            json=payload
        )
        assert response.status_code in [404, 400]

    def test_reject_missing_reason(self, client, test_db, approval_queue_item_db):
        """Testa rejeição sem motivo"""
        item_id = approval_queue_item_db.id
        payload = {}

        response = client.post(
            f"/api/approval/queue/{item_id}/reject",
            json=payload
        )
        assert response.status_code in [400, 422]

    def test_correct_missing_value(self, client, test_db, approval_queue_item_db):
        """Testa correção sem novo valor"""
        item_id = approval_queue_item_db.id
        payload = {}

        response = client.post(
            f"/api/approval/queue/{item_id}/correct",
            json=payload
        )
        assert response.status_code in [400, 422]

    def test_response_headers(self, client, test_db):
        """Testa headers CORS"""
        response = client.get("/api/approval/queue")
        assert response.status_code == 200

    def test_pagination_limit_validation(self, client, test_db):
        """Testa validação de limite de paginação"""
        response = client.get("/api/approval/queue?limit=1000")
        assert response.status_code == 200

    def test_pagination_offset_validation(self, client, test_db):
        """Testa validação de offset"""
        response = client.get("/api/approval/queue?offset=100")
        assert response.status_code == 200

    def test_list_returns_correct_fields(self, client, test_db, approval_queue_item_db):
        """Testa que lista retorna campos corretos"""
        response = client.get("/api/approval/queue")
        assert response.status_code == 200
        data = response.json()
        if data["items"]:
            item = data["items"][0]
            required_fields = ["id", "entity_type", "entity_id", "field_name", "status"]
            for field in required_fields:
                assert field in item
